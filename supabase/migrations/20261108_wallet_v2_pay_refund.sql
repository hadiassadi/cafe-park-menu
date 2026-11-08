-- ============================================================
-- پچ ۱۸ — پرداخت سفارش با کیف پول + بازپرداخت خودکار به کیف پول
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- پیش‌نیاز: هات‌فیکس ۱۷.۳ (فایل 20261108_wallet_ledger_align.sql) اجرا شده باشد.
-- ============================================================

begin;

-- ۱) پرچم فعال‌سازی «کیف پول» در تنظیمات پرداخت (پیش‌فرض خاموش؛ از پنل ادمین روشن کنید)
alter table public.settings
  add column if not exists payment_wallet_enabled boolean not null default false;

-- ۲) اگر روی order_payments.method چک سخت‌گیرانه‌ای باشد که «wallet» را نپذیرد،
--    با یک تست فرعی (subtransaction) مشخص می‌کنیم و همان چک را برمی‌داریم.
--    تست: درج با order_id ساختگی — اگر چک method رد شود check_violation می‌گیریم،
--    وگرنه FK می‌شکند که یعنی مقدار method پذیرفته شده است.
do $$
declare
  v_method_ok boolean := false;
  r record;
begin
  begin
    insert into public.order_payments (order_id, method, amount, status)
    values ('00000000-0000-0000-0000-000000000000', 'wallet', 1, 'confirmed');
  exception
    when foreign_key_violation then v_method_ok := true;
    when check_violation then v_method_ok := false;
    when others then v_method_ok := true; -- خطای دیگری (ستون ناموجود و…) ربطی به چک method ندارد
  end;

  if not v_method_ok then
    for r in
      select conname
      from pg_constraint
      where conrelid = 'public.order_payments'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%method%'
    loop
      execute format('alter table public.order_payments drop constraint %I', r.conname);
      raise notice 'چک محدودکننده‌ی method از order_payments حذف شد (%)', r.conname;
    end loop;
  end if;
end $$;

-- ۳) پرداخت باقی‌مانده سفارش از کیف پول — اتمیک
--    خروجی: jsonb { paid, balance }
create or replace function public.pay_order_with_wallet(
  p_order_id uuid,
  p_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o             record;
  v_paid        bigint;
  v_remaining   bigint;
  v_customer_id uuid;
  v_balance     bigint;
begin
  if p_device_hash is null then
    raise exception 'order_not_found';
  end if;

  select *
    into o
    from orders
   where id = p_order_id
     and device_id_hash = p_device_hash
   for update;

  if not found or o.deleted_at is not null then
    raise exception 'order_not_found';
  end if;
  if o.status in ('cancelled','canceled') then
    raise exception 'order_closed';
  end if;

  -- رسید در انتظار بررسی نباشد (همان قاعده‌ی تغییر روش پرداخت)
  if exists (
    select 1 from order_payments
    where order_id = p_order_id and status = 'pending_review'
  ) then
    raise exception 'pending_receipts';
  end if;

  -- مشتریِ کیف پول = مشتریِ همان شماره‌ی سفارش
  select c.id into v_customer_id
    from customers c
   where c.phone = o.customer_phone
   limit 1;
  if v_customer_id is null then
    raise exception 'wallet_customer_not_found';
  end if;

  select coalesce(sum(amount), 0) into v_paid
    from order_payments
   where order_id = p_order_id and status = 'confirmed';

  v_remaining := o.subtotal - v_paid;
  if v_remaining <= 0 then
    raise exception 'nothing_to_pay';
  end if;

  -- برداشت اتمیک از کیف پول (موجودی ناکافی → false)
  if not public.wallet_try_spend(
    v_customer_id,
    v_remaining,
    p_order_id,
    'خرج سفارش #' || o.order_number::text
  ) then
    raise exception 'insufficient_wallet_balance';
  end if;

  insert into order_payments
    (order_id, method, amount, status, confirmed_at, created_by, note)
  values
    (p_order_id, 'wallet', v_remaining, 'confirmed', now(), 'customer', 'پرداخت با کیف پول');

  update orders
     set payment_method = 'wallet',
         payment_verified_at = now(),
         status = case when o.status = 'pending' then 'confirmed' else o.status end,
         confirmed_at = case when o.status = 'pending' then now() else o.confirmed_at end
   where id = p_order_id;

  perform public.recalc_order_payment(p_order_id);

  select public.wallet_balance(v_customer_id) into v_balance;
  return jsonb_build_object('paid', v_remaining, 'balance', v_balance);
end;
$function$;

-- ۴) بازکردن مسیر بازپرداخت به کیف پول در لغو سفارش
--    (تا امروز این مسیر عمداً با «wallet_disabled» بسته بود)
--    همان امضای قبلی؛ create or replace واقعی — نه overload.
create or replace function public.cancel_order_atomic(
  p_order_id uuid,
  p_cancelled_by text,
  p_device_hash text default null::text,
  p_reason_id uuid default null::uuid,
  p_reason_label text default null::text,
  p_note text default null::text,
  p_refund_method text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o             record;
  v_paid        bigint;
  v_review      int;
  v_refunded    bigint := 0;
  v_customer_id uuid;
begin
  if p_cancelled_by not in ('customer','admin') then
    raise exception 'invalid_actor';
  end if;

  select id, order_number, status, deleted_at, created_at, customer_confirmed,
         payment_status, payment_receipt_url, payment_note, device_id_hash, customer_phone
    into o
    from orders
   where id = p_order_id
   for update;

  if not found or o.deleted_at is not null then
    raise exception 'order_not_found';
  end if;
  if p_cancelled_by = 'customer'
     and (p_device_hash is null or o.device_id_hash is distinct from p_device_hash) then
    raise exception 'order_not_found';
  end if;
  if o.status in ('cancelled','canceled') then raise exception 'already_cancelled'; end if;
  if o.status = 'delivered' then raise exception 'order_delivered'; end if;

  select coalesce(sum(amount) filter (where status = 'confirmed'), 0),
         count(*) filter (where status = 'pending_review')
    into v_paid, v_review
    from order_payments
   where order_id = p_order_id;

  if v_review > 0 then raise exception 'pending_receipts'; end if;

  if p_cancelled_by = 'customer' then
    if o.status <> 'pending' or o.customer_confirmed then raise exception 'not_cancellable'; end if;
    if v_paid > 0 or o.payment_status = 'paid'
       or o.payment_receipt_url is not null or o.payment_note is not null then
      raise exception 'paid_or_receipt';
    end if;
    if now() - o.created_at > interval '5 minutes' then raise exception 'window_expired'; end if;
  end if;

  -- بازپرداخت پول دریافت‌شده
  if v_paid > 0 then
    if p_refund_method is null or p_refund_method not in ('cash','wallet','gateway_manual') then
      raise exception 'refund_method_required';
    end if;

    if p_refund_method = 'wallet' then
      select c.id into v_customer_id
        from customers c
       where c.phone = o.customer_phone
       limit 1;
      if v_customer_id is null then
        raise exception 'wallet_customer_not_found';
      end if;
      -- شارژ «بازگشت وجه» بلافاصله در کیف پول مشتری می‌نشیند
      perform public.wallet_charge(
        v_customer_id,
        v_paid,
        'refund',
        'بازپرداخت لغو سفارش #' || o.order_number::text,
        p_order_id
      );
    end if;

    insert into order_refunds
      (order_id, order_number, customer_phone, amount, method, note,
       status, source, completed_at)
    values
      (o.id, o.order_number, o.customer_phone, v_paid, p_refund_method, p_note,
       case when p_refund_method = 'wallet' then 'completed' else 'pending_manual' end,
       case when p_refund_method = 'wallet' then 'wallet_auto' else 'admin_cancel' end,
       case when p_refund_method = 'wallet' then now() else null end);

    v_refunded := v_paid;
  end if;

  update orders
     set status = 'cancelled',
         cancelled_by = p_cancelled_by,
         cancelled_at = now(),
         cancellation_reason_id = p_reason_id,
         cancellation_reason_label = left(p_reason_label, 100),
         cancellation_note = left(p_note, 500)
   where id = p_order_id;
  -- کوپن را تریگر orders_sync_coupon_usage برمی‌گرداند

  delete from redemption_logs where order_id = p_order_id;

  return jsonb_build_object('refunded', v_refunded, 'refund_method', p_refund_method);
end;
$function$;

commit;

-- [تایید] هر دو تابع باید با همین امضاها باشند (بدون تکرار/overload):
select p.oid::regprocedure::text as fn
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('pay_order_with_wallet','cancel_order_atomic','wallet_charge')
order by 1;
