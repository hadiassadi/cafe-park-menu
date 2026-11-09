-- ============================================================
-- پچ ۲۸ — فاز ۴ کیف پول: اشتراک ماهیانه
--   • subscription_plans: پلن‌های ادمین (قیمت، مدت، درصد تخفیف، مزایا)
--   • customer_subscriptions: اشتراک فعال مشتری (اسنپ‌شات پلن در لحظه‌ی خرید)
--   • خرید با کیف پول: RPC اتمیک purchase_subscription_with_wallet
--   • خرید کارت‌به‌کارت: wallet_charge_requests.purpose='subscription' → صف تأیید ادمین
--   • orders.subscription_discount: سهم تخفیف اشتراک در سفارش (گزارش‌گیری)
--   • settings.subscription_enabled: سوییچ سراسری نمایش/خرید
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- ۱) سوییچ سراسری + ستون گزارش اشتراک روی سفارش
-- ------------------------------------------------------------
alter table public.settings
  add column if not exists subscription_enabled boolean not null default false;

alter table public.orders
  add column if not exists subscription_discount bigint not null default 0;

-- ------------------------------------------------------------
-- ۲) جدول پلن‌ها — فقط سرور (service role) دسترسی دارد
-- ------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  price bigint not null check (price >= 0),
  duration_days integer not null check (duration_days between 1 and 3650),
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  benefits text,
  sort_order integer not null default 10 check (sort_order between 0 and 999),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ۳) جدول اشتراک‌های مشتریان — اسنپ‌شات پلن در لحظه‌ی خرید
--    (تغییر/حذف پلن، اشتراک‌های خریداری‌شده را تغییر نمی‌دهد)
-- ------------------------------------------------------------
create table if not exists public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  plan_name text not null,
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  price_paid bigint not null default 0 check (price_paid >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  source text not null default 'wallet' check (source in ('wallet', 'card_to_card', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists customer_subscriptions_customer_idx
  on public.customer_subscriptions (customer_id, status);

-- یک اشتراکِ فعال برای هر مشتری — در سطح دیتابیس تضمین می‌شود
create unique index if not exists customer_subscriptions_one_active
  on public.customer_subscriptions (customer_id)
  where status = 'active';

-- ------------------------------------------------------------
-- ۴) RLS: خواندن/نوشتن فقط از سرور (الگوی revokeهای قبلی)
-- ------------------------------------------------------------
alter table public.subscription_plans enable row level security;
alter table public.customer_subscriptions enable row level security;

revoke all on public.subscription_plans from anon, authenticated;
revoke all on public.customer_subscriptions from anon, authenticated;

-- ------------------------------------------------------------
-- ۵) درخواست خرید اشتراک با کارت‌به‌کارت در همان صف شارژ:
--    purpose='subscription' + پلن انتخابی + اسنپ‌شات نام
-- ------------------------------------------------------------
alter table public.wallet_charge_requests
  add column if not exists purpose text not null default 'wallet_charge';

alter table public.wallet_charge_requests
  add column if not exists plan_id uuid references public.subscription_plans(id) on delete set null;

alter table public.wallet_charge_requests
  add column if not exists plan_name text;

-- ------------------------------------------------------------
-- ۶) RPC خرید اشتراک با کیف پول — اتمیک و ضد دوبار‌خرید:
--    قفل مشاوره‌ای مشتری + ایندکس یکتای «یک اشتراک فعال»
--    پیام‌های خطا: plan_not_found / already_active / insufficient_balance
-- ------------------------------------------------------------
create or replace function public.purchase_subscription_with_wallet(
  p_customer_id uuid,
  p_plan_id uuid
)
returns table (subscription_id uuid, ends_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_plan record;
  v_price bigint;
  v_balance bigint;
  v_new_ends timestamptz;
  v_sub_id uuid;
begin
  if p_customer_id is null or p_plan_id is null then
    raise exception 'plan_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select price, discount_percent, name, duration_days, is_active
    into v_plan
  from subscription_plans
  where id = p_plan_id;

  if not found or v_plan.is_active = false then
    raise exception 'plan_not_found';
  end if;

  -- اشتراک فعالِ گذشته‌ی تاریخ، «منقضی» می‌شود (خودترمیم؛ ایندکس یکتا باز می‌شود)
  update customer_subscriptions
     set status = 'expired'
   where customer_id = p_customer_id
     and status = 'active'
     and ends_at <= now();

  if exists (
    select 1 from customer_subscriptions
    where customer_id = p_customer_id and status = 'active'
  ) then
    raise exception 'already_active';
  end if;

  v_price := v_plan.price;
  if v_price > 0 then
    select wallet_balance(p_customer_id) into v_balance;
    if v_balance < v_price then
      raise exception 'insufficient_balance';
    end if;

    insert into wallet_transactions
      (customer_id, customer_phone, amount, kind, status, note, created_by)
    select c.id, c.phone, -v_price, 'subscription_purchase', 'settled',
           'خرید اشتراک «' || v_plan.name || '»', 'customer'
    from customers c
    where c.id = p_customer_id;

    if not found then
      raise exception 'plan_not_found';
    end if;
  end if;

  v_new_ends := now() + (v_plan.duration_days || ' days')::interval;

  insert into customer_subscriptions
    (customer_id, plan_id, plan_name, discount_percent, price_paid, starts_at, ends_at, status, source)
  values
    (p_customer_id, p_plan_id, v_plan.name, v_plan.discount_percent, v_price, now(), v_new_ends, 'active', 'wallet')
  returning id into v_sub_id;

  return query select v_sub_id, v_new_ends;
end $$;

-- ------------------------------------------------------------
-- ۷) RPC اعطای اشتراک بدون کیف پول — تأیید رسید کارت‌به‌کارت توسط ادمین
--    (همان گارد «یک اشتراک فعال»؛ تراکنش کیف پولی ثبت نمی‌شود)
-- ------------------------------------------------------------
create or replace function public.grant_subscription(
  p_customer_id uuid,
  p_plan_id uuid,
  p_source text default 'card_to_card'
)
returns table (subscription_id uuid, ends_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_plan record;
  v_new_ends timestamptz;
  v_sub_id uuid;
begin
  if p_customer_id is null or p_plan_id is null then
    raise exception 'plan_not_found';
  end if;
  if p_source not in ('card_to_card', 'admin') then
    raise exception 'plan_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select discount_percent, name, duration_days, is_active
    into v_plan
  from subscription_plans
  where id = p_plan_id;

  if not found or v_plan.is_active = false then
    raise exception 'plan_not_found';
  end if;

  update customer_subscriptions
     set status = 'expired'
   where customer_id = p_customer_id
     and status = 'active'
     and ends_at <= now();

  if exists (
    select 1 from customer_subscriptions
    where customer_id = p_customer_id and status = 'active'
  ) then
    raise exception 'already_active';
  end if;

  v_new_ends := now() + (v_plan.duration_days || ' days')::interval;

  insert into customer_subscriptions
    (customer_id, plan_id, plan_name, discount_percent, price_paid, starts_at, ends_at, status, source)
  values
    (p_customer_id, p_plan_id, v_plan.name, v_plan.discount_percent, 0, now(), v_new_ends, 'active', p_source)
  returning id into v_sub_id;

  return query select v_sub_id, v_new_ends;
end $$;

commit;
