-- ============================================================
-- پچ ۳۸ — پرداخت ترکیبی: بخشی از سفارش از کیف پول، باقی‌مانده از درگاه
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- پیش‌نیاز: 20261108_wallet_v2_pay_refund.sql (نسخه‌ی فعلی pay_order_with_wallet)
-- ============================================================

begin;

-- pay_order_with_wallet با پارامتر اختیاری p_amount:
--   * p_amount = null  → پرداخت «کل باقی‌مانده» (رفتار قبلی، بدون تغییر)
--   * p_amount = N     → پرداخت «بخشی» به اندازه‌ی N از کیف پول؛ سفارش باز می‌ماند
--                        تا باقی‌مانده با درگاه/روش دیگر تسویه شود (وضعیت payment_status = partial)
-- توجه: create or replace واقعی است — overload جدیدی ساخته نمی‌شود.
create or replace function public.pay_order_with_wallet(
  p_order_id uuid,
  p_device_hash text,
  p_amount bigint default null
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
  v_spend       bigint;
  v_full_pay    boolean;
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

  -- مبلغ جزئی اختیاری (پرداخت ترکیبی)
  if p_amount is null then
    v_spend := v_remaining;
  else
    if p_amount <= 0 then
      raise exception 'invalid_amount';
    end if;
    if p_amount > v_remaining then
      raise exception 'amount_exceeds_remaining';
    end if;
    v_spend := p_amount;
  end if;
  v_full_pay := (v_spend = v_remaining);

  -- برداشت اتمیک از کیف پول (موجودی ناکافی → false)
  if not public.wallet_try_spend(
    v_customer_id,
    v_spend,
    p_order_id,
    case when v_full_pay
      then 'خرج سفارش #' || o.order_number::text
      else 'پرداخت ترکیبی سفارش #' || o.order_number::text || ' (بخش کیف پول)'
    end
  ) then
    raise exception 'insufficient_wallet_balance';
  end if;

  insert into order_payments
    (order_id, method, amount, status, confirmed_at, created_by, note)
  values
    (p_order_id, 'wallet', v_spend, 'confirmed', now(), 'customer',
     case when v_full_pay
       then 'پرداخت با کیف پول'
       else 'پرداخت ترکیبی — بخش کیف پول'
     end);

  if v_full_pay then
    -- پرداخت کامل: همان رفتار قبلی — سفارش تأیید می‌شود
    update orders
       set payment_method = 'wallet',
           payment_verified_at = now(),
           status = case when o.status = 'pending' then 'confirmed' else o.status end,
           confirmed_at = case when o.status = 'pending' then now() else o.confirmed_at end
     where id = p_order_id;
  end if;
  -- پرداخت جزئی: وضعیت/روش سفارش دست نمی‌خورد تا باقی‌مانده با درگاه تسویه شود

  perform public.recalc_order_payment(p_order_id);

  -- تضمین وضعیت «partial»: بخشی تأیید شده ولی هنوز باقی‌مانده دارد
  update orders o2
     set payment_status = 'partial'
   where o2.id = p_order_id
     and (select coalesce(sum(op.amount), 0) from order_payments op
           where op.order_id = o2.id and op.status = 'confirmed') > 0
     and (select coalesce(sum(op.amount), 0) from order_payments op
           where op.order_id = o2.id and op.status = 'confirmed') < o2.subtotal;

  select public.wallet_balance(v_customer_id) into v_balance;
  return jsonb_build_object(
    'paid', v_spend,
    'balance', v_balance,
    'remaining', v_remaining - v_spend
  );
end;
$function$;

commit;

-- [تایید] تابع باید با همان نام و یک امضا (سه آرگومان با پیش‌فرض) باشد:
select p.oid::regprocedure::text as fn
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'pay_order_with_wallet'
order by 1;
