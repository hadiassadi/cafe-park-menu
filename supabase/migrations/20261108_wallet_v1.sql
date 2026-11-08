-- کیف پول مشتری — بخش ۱: زیرساخت (پچ ۱۷)
-- جدول wallet_transactions از قبل وجود دارد؛ این مایگریشن ستون‌های لازم را
-- به‌صورت idempotent هم‌تراز می‌کند و توابع اتمیک موجودی/خرج/شارژ را می‌سازد.

-- هویت: پیوند نشست OTP (کوکی هش تلفن) به مشتری
alter table public.customers add column if not exists phone_hash text;
create unique index if not exists customers_phone_hash_uq
  on public.customers (phone_hash) where phone_hash is not null;

-- هم‌ترازسازی ستون‌های دفتر کیف پول
alter table public.wallet_transactions add column if not exists customer_id uuid;
alter table public.wallet_transactions add column if not exists amount bigint;
alter table public.wallet_transactions add column if not exists kind text;
alter table public.wallet_transactions add column if not exists status text default 'settled';
alter table public.wallet_transactions add column if not exists order_id uuid;
alter table public.wallet_transactions add column if not exists note text;
alter table public.wallet_transactions add column if not exists created_at timestamptz default now();

create index if not exists wallet_tx_customer_idx
  on public.wallet_transactions (customer_id, created_at desc);

-- کلید روشن/خاموش کیف پول (تا تست کامل نشده خاموش می‌ماند)
alter table public.settings add column if not exists wallet_enabled boolean default false;

-- موجودی = جمع تراکنش‌های تسویه‌شده (رقم مثبت = شارژ، منفی = خرج)
create or replace function public.wallet_balance(p_customer_id uuid)
returns bigint
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(sum(amount), 0)::bigint
  from wallet_transactions
  where customer_id = p_customer_id and status = 'settled';
$$;

-- برداشت اتمیک: فقط اگر موجودی کافی باشد. قفل مشاوره‌ای روی مشتری،
-- جلوی دو خرج هم‌زمان را می‌گیرد (نتایج منفی غیرممکن می‌شود).
create or replace function public.wallet_try_spend(
  p_customer_id uuid,
  p_amount bigint,
  p_order_id uuid,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_balance bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select wallet_balance(p_customer_id) into v_balance;
  if v_balance < p_amount then
    return false;
  end if;

  insert into wallet_transactions (customer_id, amount, kind, status, order_id, note)
  values (p_customer_id, -p_amount, 'spend', 'settled', p_order_id, p_note);

  return true;
end $$;

-- شارژ: توسط ادمین (و در آینده پرداخت آنلاین)
create or replace function public.wallet_charge(
  p_customer_id uuid,
  p_amount bigint,
  p_kind text default 'admin_charge',
  p_note text default null
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
  if p_kind not in ('admin_charge', 'online_charge', 'refund') then
    raise exception 'invalid_kind';
  end if;
  if (select wallet_balance(p_customer_id)) + p_amount > 9223372036854775807::bigint then
    raise exception 'overflow';
  end if;

  insert into wallet_transactions (customer_id, amount, kind, status, note)
  values (p_customer_id, p_amount, p_kind, 'settled', p_note);
end $$;
