-- کیف پول مشتری — هم‌ترازسازی جدول قدیمی wallet_transactions با پچ ۱۷ (هات‌فیکس ۱۷.۲)
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- این فایل idempotent است؛ اجرای مکرر بی‌ضرر است.

-- پس‌زمینه: جدول wallet_transactions قبل از پچ ۱۷ با طراحی دیگری وجود داشت:
--   customer_phone NOT NULL + created_by NOT NULL با CHECK ('admin','customer','system')
--   + CHECK روی kind فقط ('refund','spend','adjust')
-- توابع جدید با customer_id و kind='admin_charge' درج می‌کنند و به همین دلیل
-- با خطای 23502 (null در customer_phone) متوقف می‌شدند.

-- ۱) customer_phone انعطاف می‌گیرد؛ توابع ما همچنان آن را از customers.phone پر می‌کنند
alter table public.wallet_transactions
  alter column customer_phone drop not null;

-- ۲) kind باید مقادیر جدید را هم بپذیرد (مقادیر قدیمی حفظ می‌شوند)
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check
  check (kind in ('refund', 'spend', 'adjust', 'admin_charge', 'online_charge'));

-- ۳) created_by: همان CHECK قدیمی می‌ماند؛ پیش‌فرض system تا هیچ درجی خالی نماند
alter table public.wallet_transactions
  alter column created_by set default 'system';

-- ۴) ردیف‌های قدیمی (اگر بوده باشد) با تطابق شماره تلفن به هویت جدید وصل می‌شوند
update public.wallet_transactions wt
set customer_id = c.id
from public.customers c
where wt.customer_id is null
  and wt.customer_phone = c.phone;

-- ۵) تراکنش‌های قدیمیِ بدون status، تسویه‌شده فرض می‌شوند تا در محاسبه موجودی بشمارند
update public.wallet_transactions
set status = 'settled'
where status is null;

-- ۶) شارژ: با پر کردن customer_phone و created_by؛ p_order_id برای بازپرداخت‌های پچ ۱۸
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
  if p_kind not in ('admin_charge', 'online_charge', 'refund') then
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
      when 'online_charge' then 'customer'
      else 'system'
    end
  from customers c
  where c.id = p_customer_id;

  if not found then
    raise exception 'customer_not_found';
  end if;
end $$;

-- ۷) برداشت اتمیک برای خرج سفارش (پچ ۱۸): همان قفل مشاوره‌ای + پر کردن ستون‌های قدیمی
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

  insert into wallet_transactions
    (customer_id, customer_phone, amount, kind, status, order_id, note, created_by)
  select
    c.id,
    c.phone,
    -p_amount,
    'spend',
    'settled',
    p_order_id,
    p_note,
    'customer'
  from customers c
  where c.id = p_customer_id;

  return found;
end $$;
