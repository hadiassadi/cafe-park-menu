-- پرداخت پس از لغو سفارش: ثبت ردیف بازپرداخت دستی
-- این فایل idempotent است و روی دیتابیسی که این تغییرات را دارد، بی‌خطر اجرا می‌شود.
-- پیش‌فرض: جدول order_refunds از قبل وجود دارد.

begin;

-- ۱) ستون‌های جدید
alter table public.order_refunds
  add column if not exists status text not null default 'completed',
  add column if not exists payment_id uuid references public.order_payments(id),
  add column if not exists source text not null default 'admin_cancel',
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid;

-- ۲) قید مقادیر مجاز status
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.order_refunds'::regclass
       and conname = 'order_refunds_status_check'
  ) then
    alter table public.order_refunds
      add constraint order_refunds_status_check
      check (status in ('completed', 'pending_manual'));
  end if;
end $$;

-- ۳) ایندکس‌ها
-- هر لغو دستی یک ردیف دارد؛ ردیف‌های مربوط به پرداخت با payment_id یکتا می‌شوند.
drop index if exists public.order_refunds_one_per_order;

create unique index if not exists order_refunds_one_per_order_nopay
  on public.order_refunds (order_id)
  where payment_id is null;

create unique index if not exists order_refunds_payment_id_uidx
  on public.order_refunds (payment_id)
  where payment_id is not null;

-- ۴) تابع تغییر وضعیت پرداخت
create or replace function public.set_order_payment_status(
  p_payment_id  uuid,
  p_new_status  text,
  p_verified_by uuid default null,
  p_ref_id      text default null,
  p_reason      text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order_id uuid;
  v_old      text;
  v_amount   bigint;
  v_method   text;
  o          record;
  v_result   text;
begin
  if p_new_status not in ('confirmed','rejected','failed') then
    raise exception 'invalid_status';
  end if;

  select order_id into v_order_id from order_payments where id = p_payment_id;
  if not found then raise exception 'payment_not_found'; end if;

  select id, order_number, status, deleted_at, customer_phone
    into o
    from orders
   where id = v_order_id
   for update;

  select status, amount, method
    into v_old, v_amount, v_method
    from order_payments
   where id = p_payment_id
   for update;

  if v_old not in ('pending','pending_review') then
    raise exception 'payment_already_final';
  end if;

  update order_payments
     set status        = p_new_status,
         ref_id        = coalesce(p_ref_id, ref_id),
         reject_reason = case when p_new_status in ('rejected','failed') then p_reason else reject_reason end,
         verified_by   = coalesce(p_verified_by, verified_by),
         confirmed_at  = case when p_new_status = 'confirmed' then now() else confirmed_at end,
         updated_at    = now()
   where id = p_payment_id;

  v_result := recalc_order_payment(v_order_id);

  -- پرداخت روی سفارش لغوشده یا حذف‌شده: وجه باید دستی برگردد
  if p_new_status = 'confirmed'
     and (o.status in ('cancelled','canceled') or o.deleted_at is not null) then
    insert into order_refunds
      (order_id, order_number, customer_phone, amount, method, note,
       status, payment_id, source)
    values
      (o.id, o.order_number, o.customer_phone, v_amount,
       case when v_method = 'online' then 'gateway_manual' else 'cash' end,
       'پرداخت پس از لغو سفارش؛ وجه باید به مشتری برگردد',
       'pending_manual', p_payment_id, 'paid_after_cancel');
  end if;

  return v_result;
end;
$function$;

commit;
