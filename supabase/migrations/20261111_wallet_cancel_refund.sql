-- ============================================================
-- پچ ۳۹ — لغو سفارشِ با پرداخت جزئی کیف‌پولی: بازگشت خودکار به کیف پول
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- پیش‌نیاز: 20261111_wallet_partial_pay.sql (پچ ۳۸)
-- ============================================================
-- مشکل: مشتری بعد از پرداخت ترکیبی (بخش کیف پول کسر شده ولی سفارش هنوز pending)
-- نمی‌توانست سفارش را لغو کند («سفارش پرداخت‌شده... فقط کافه»).
-- راه‌حل: اگر همه‌ی پرداخت‌های تأییدشده‌ی سفارش از نوع «wallet» باشند، لغو توسط
-- مشتری مجاز است و مبلغ به‌صورت خودکار و آنی به کیف پول خودش برمی‌گردد.
-- اگر هر پرداخت غیرکیف‌پولی (نقدی/درگاه/...) تأیید شده باشد، رفتار قبلی حفظ می‌شود.

begin;

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
  o                 record;
  v_paid            bigint;
  v_nonwallet_paid  bigint;
  v_review          int;
  v_refunded        bigint := 0;
  v_refund_method   text;
  v_customer_id     uuid;
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
         coalesce(sum(amount) filter (where status = 'confirmed' and method <> 'wallet'), 0),
         count(*) filter (where status = 'pending_review')
    into v_paid, v_nonwallet_paid, v_review
    from order_payments
   where order_id = p_order_id;

  if v_review > 0 then raise exception 'pending_receipts'; end if;

  if p_cancelled_by = 'customer' then
    if o.status <> 'pending' or o.customer_confirmed then raise exception 'not_cancellable'; end if;
    -- پرداخت غیرکیف‌پولی (نقدی/درگاه/...) یا سفارش کاملاً تسویه‌شده: فقط کافه
    -- (پرداخت جزئیِ فقط-کیف‌پولی مجاز است؛ پول خودکار به کیف پول برمی‌گردد)
    if v_nonwallet_paid > 0 or o.payment_status = 'paid'
       or o.payment_receipt_url is not null or o.payment_note is not null then
      raise exception 'paid_or_receipt';
    end if;
    if now() - o.created_at > interval '5 minutes' then raise exception 'window_expired'; end if;
  end if;

  -- روش بازپرداخت: برای لغوی مشتری که فقط پرداخت کیف‌پولی دارد، خودکار «کیف پول»
  v_refund_method := p_refund_method;
  if p_cancelled_by = 'customer' and v_paid > 0 and v_nonwallet_paid = 0 then
    v_refund_method := 'wallet';
  end if;

  -- بازپرداخت پول دریافت‌شده
  if v_paid > 0 then
    if v_refund_method is null or v_refund_method not in ('cash','wallet','gateway_manual') then
      raise exception 'refund_method_required';
    end if;

    if v_refund_method = 'wallet' then
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
      (o.id, o.order_number, o.customer_phone, v_paid, v_refund_method, p_note,
       case when v_refund_method = 'wallet' then 'completed' else 'pending_manual' end,
       case when v_refund_method = 'wallet' then 'wallet_auto' else 'admin_cancel' end,
       case when v_refund_method = 'wallet' then now() else null end);

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

  return jsonb_build_object('refunded', v_refunded, 'refund_method', v_refund_method);
end;
$function$;

commit;

-- [تایید] تابع باید با همان امضای قبلی باشد (بدون overload جدید):
select p.oid::regprocedure::text as fn
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'cancel_order_atomic'
order by 1;
