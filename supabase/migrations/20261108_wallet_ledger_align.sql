-- ============================================================
-- هات‌فیکس ۱۷.۳ — نسخه‌ی کامل و اصلاح‌شده‌ی هم‌ترازسازی کیف پول
-- (جایگزین کامل ۱۷.۲ — اجرای مجدد بی‌ضرر است)
--
-- چرا ۱۷.۲ اثر نکرد؟
--   در ۱۷.۲ تابع wallet_charge با یک پارامتر جدید (p_order_id) با
--   create or replace ساخته شد؛ در پستگرس این کار تابع قبلی را
--   جایگزین نمی‌کند بلکه یک نسخه‌ی موازی (overload) می‌سازد.
--   پنل با ۴ آرگومان صدا می‌زند و همچنان بدنه‌ی قدیمی اجرا می‌شد
--   (خطای 23502 روی customer_phone) و «شارژ ناموفق بود» می‌داد.
-- راه‌حل: اول هر دو نسخه drop می‌شوند، بعد تابع نهایی ساخته می‌شود.
-- ============================================================

-- [بررسی قبل از اجرا] نسخه‌های فعلی wallet_charge — احتمالاً دو سطر می‌بینید
select p.oid::regprocedure::text as wallet_charge_overloads
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'wallet_charge';

-- ۱) انعطاف ستون‌های جدول قدیمی (idempotent)
alter table public.wallet_transactions
  alter column customer_phone drop not null;
alter table public.wallet_transactions
  alter column created_by set default 'system';

-- ۲) بازکردن CHECK روی kind برای مقادیر جدید (مقادیر قدیمی حفظ می‌شوند)
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check
  check (kind in ('refund', 'spend', 'adjust', 'admin_charge', 'online_charge'));

-- ۳) اتصال ردیف‌های قدیمی به هویت جدید + تسویه‌شده فرض کردن آن‌ها
update public.wallet_transactions wt
set customer_id = c.id
from public.customers c
where wt.customer_id is null
  and wt.customer_phone = c.phone;

update public.wallet_transactions
set status = 'settled'
where status is null;

-- ۴) نکته‌ی کلیدی: حذف هر دو نسخه‌ی wallet_charge (قدیمیِ ۴-آرگومانه و جدیدِ ۵-آرگومانه)
drop function if exists public.wallet_charge(uuid, bigint, text, text);
drop function if exists public.wallet_charge(uuid, bigint, text, text, uuid);

-- ۵) ساخت نسخه‌ی نهایی شارژ (پر کردن customer_phone و created_by + پشتیبانی order_id)
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

-- ۶) بازسازی مطمئنِ برداشت اتمیک برای خرج سفارش (پچ ۱۸)
drop function if exists public.wallet_try_spend(uuid, bigint, uuid, text);
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
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  if (select wallet_balance(p_customer_id)) < p_amount then
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

-- [تایید بعد از اجرا] باید فقط «یک» سطر با ۵ آرگومان ببینید:
-- wallet_charge(p_customer_id uuid, p_amount bigint, p_kind text, p_note text, p_order_id uuid)
select p.oid::regprocedure::text as wallet_charge_final
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'wallet_charge';
