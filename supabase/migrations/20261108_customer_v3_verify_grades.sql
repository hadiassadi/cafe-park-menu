-- ============================================================
-- پچ ۲۱ — احراز هویت مشتری (QR/لینک دعوت) + گرید + اشتراک + رسید شارژ
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- پیش‌نیاز: مایگریشن‌های کیف پول (v1 ، ledger_align ، v2) اجرا شده باشند.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- ۱) گریدهای مشتریان عادی (وفاداری بر اساس مجموع خرید)
-- ------------------------------------------------------------
create table if not exists public.customer_grades (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_total bigint not null default 0,
  discount_percent numeric(5,2) not null default 0,
  color text default '#6b4f3a',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- پیش‌فرض‌های اولیه (مدیر بعداً از پنل تغییر می‌دهد) — با UUID ثابت تا اجرای مجدد تکراری نسازد
insert into public.customer_grades (id, name, min_total, discount_percent, color, sort_order)
values
  ('00000000-0000-0000-0000-00000000a001', 'برنز',   0,          0, '#a1785a', 1),
  ('00000000-0000-0000-0000-00000000a002', 'نقره‌ای', 10000000,  2, '#9aa5b1', 2),
  ('00000000-0000-0000-0000-00000000a003', 'طلایی',  30000000,   4, '#d4af37', 3),
  ('00000000-0000-0000-0000-00000000a004', 'الماس',  70000000,   6, '#7c9eb8', 4)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- ۲) ستون‌های جدید مشتری: احراز، نوع، گرید، مسدودسازی
-- ------------------------------------------------------------
alter table public.customers add column if not exists verification_status text not null default 'unverified';
alter table public.customers add column if not exists verified_at timestamptz;
alter table public.customers add column if not exists customer_type text not null default 'normal';
alter table public.customers add column if not exists total_purchase bigint not null default 0;
alter table public.customers add column if not exists grade_updated_at timestamptz;
alter table public.customers add column if not exists wallet_blocked boolean not null default false;
alter table public.customers add column if not exists card_charge_blocked boolean not null default false;

do $$
begin
  -- چک‌ها فقط اگر نبودند ساخته می‌شوند (نام ثابت برای idempotency)
  if not exists (select 1 from pg_constraint where conname = 'customers_verification_status_check') then
    alter table public.customers add constraint customers_verification_status_check
      check (verification_status in ('unverified', 'pending', 'verified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_customer_type_check') then
    alter table public.customers add constraint customers_customer_type_check
      check (customer_type in ('normal', 'organization'));
  end if;
end $$;

-- گرید فعلی مشتری‌ها از روی مجموع خرید محاسبه‌شده فعلی پر نمی‌شود؛
-- فاز ۳ (پچ ۲۳) بعد از هر سفارش تکمیل‌شده ارتقا می‌دهد.

-- ------------------------------------------------------------
-- ۳) دعوت‌نامه ثبت‌نام (QR / لینک — تک‌مصرف با انقضا)
-- ------------------------------------------------------------
create table if not exists public.registration_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_phone text,
  is_active boolean not null default true,
  created_by text default 'admin',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ۴) درخواست فعال‌سازی حضوری کیف پول (مشتری → ادمین)
-- ------------------------------------------------------------
create table if not exists public.wallet_activation_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text,
  phone text,
  status text not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wallet_act_req_status_idx
  on public.wallet_activation_requests (status, created_at desc);

-- ------------------------------------------------------------
-- ۵) درخواست شارژ کارت‌به‌کارت با رسید (فاز ۲ — جدول از حالا ساخته می‌شود)
-- ------------------------------------------------------------
create table if not exists public.wallet_charge_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount bigint not null,
  status text not null default 'pending',
  receipt_url text,
  tracking_no text,
  paid_at timestamptz,
  reject_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wallet_charge_req_status_idx
  on public.wallet_charge_requests (status, created_at desc);

-- ------------------------------------------------------------
-- ۶) اشتراک ماهیانه (فاز ۴ — جدول‌ها از حالا ساخته می‌شوند)
-- ------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price bigint not null,
  duration_days integer not null default 30,
  discount_percent numeric(5,2) not null default 0,
  benefits text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active',
  payment_kind text,
  created_at timestamptz not null default now()
);
create index if not exists customer_subs_customer_idx
  on public.customer_subscriptions (customer_id, status, expires_at desc);

-- ------------------------------------------------------------
-- ۷) تنظیمات: سوییچ‌های سراسری + سیاست تخفیف
-- ------------------------------------------------------------
alter table public.settings add column if not exists wallet_card_charge_enabled boolean not null default false;
alter table public.settings add column if not exists wallet_charge_min bigint not null default 50000;
alter table public.settings add column if not exists membership_enabled boolean not null default true;
alter table public.settings add column if not exists discount_policy text not null default 'max';
alter table public.settings add column if not exists grade_stack_cap numeric(5,2) not null default 10;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_discount_policy_check') then
    alter table public.settings add constraint settings_discount_policy_check
      check (discount_policy in ('max', 'membership_first', 'grade_first', 'stacked'));
  end if;
end $$;

-- ------------------------------------------------------------
-- ۸) دفتر کیف پول: انواع تراکنش جدید + بازسازی wallet_charge
--    (الگوی هات‌فیکس ۱۷.۳: اول drop هر دو نسخه، بعد ساخت نسخه نهایی)
-- ------------------------------------------------------------
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check
  check (kind in ('refund', 'spend', 'adjust', 'admin_charge', 'online_charge',
                  'receipt_charge', 'subscription_purchase', 'wallet_activation'));

drop function if exists public.wallet_charge(uuid, bigint, text);
drop function if exists public.wallet_charge(uuid, bigint, text, text);
drop function if exists public.wallet_charge(uuid, bigint, text, text, uuid);

create or replace function public.wallet_charge(
  p_customer_id uuid,
  p_amount bigint,
  p_kind text default 'admin_charge',
  p_note text default null,
  p_order_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_kind not in ('admin_charge', 'online_charge', 'refund',
                    'receipt_charge', 'subscription_purchase') then
    raise exception 'invalid_kind';
  end if;
  if (select wallet_balance(p_customer_id)) + p_amount > 9223372036854775807::bigint then
    raise exception 'overflow';
  end if;

  insert into wallet_transactions
    (customer_id, customer_phone, amount, kind, status, order_id, note, created_by)
  select
    c.id,
    c.phone,
    p_amount,
    p_kind,
    'settled',
    p_order_id,
    p_note,
    case p_kind
      when 'admin_charge' then 'admin'
      when 'receipt_charge' then 'admin'
      else 'customer'
    end
  from customers c
  where c.id = p_customer_id;

  if not found then
    raise exception 'customer_not_found';
  end if;
end $$;

-- رویداد «فعال‌سازی کیف پول» مبلغ صفر دارد و از کد سرور مستقیم درج می‌شود
-- (خارج از wallet_charge چون آن تابع مبلغ مثبت می‌خواهد)

commit;
