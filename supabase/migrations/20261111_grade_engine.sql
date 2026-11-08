-- ============================================================
-- پچ ۲۷ — فاز ۳ کیف پول: گرید مشتری و موتور تخفیف
--   • customers.grade_id (گریدِ ذخیره‌شده؛ فقط ارتقا)
--   • orders.grade_discount + orders.purchase_counted (ضد دوبارشماری)
--   • RPC اتمیک credit_completed_purchase: بعد از تحویل، مجموع خرید
--     مشتری بالا می‌رود و گرید فقط به بالا ارتقا می‌یابد
--   • backfill گرید موجودی‌ها از روی total_purchase فعلی
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- پیش‌نیاز: مایگریشن 20261108 (جدول customer_grades + ستون total_purchase)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- ۱) گرید ذخیره‌شده‌ی مشتری + ستون‌های موتور روی سفارش
-- ------------------------------------------------------------
alter table public.customers
  add column if not exists grade_id uuid references public.customer_grades(id) on delete set null;

alter table public.orders
  add column if not exists grade_discount bigint not null default 0;

alter table public.orders
  add column if not exists purchase_counted boolean not null default false;

-- ------------------------------------------------------------
-- ۲) RLS روی گریدها: خواندن/نوشتن فقط از سرور (service role) —
--    کلاینتِ ناشناس هیچ دسترسی‌ای ندارد (الگوی revokeهای قبلی)
-- ------------------------------------------------------------
alter table public.customer_grades enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customer_grades') then
    -- بدون policy: anon/authenticated هیچ می‌بینند؛ فقط service role (بای‌پس RLS)
    null;
  end if;
end $$;

revoke all on public.customer_grades from anon, authenticated;

-- ------------------------------------------------------------
-- ۳) backfill: گریدِ فعلی هر مشتری از روی total_purchase موجود
--    (نسبت‌دهی اولیه — قاعده‌ی فقط-ارتقا از این به بعد در RPC است)
-- ------------------------------------------------------------
update public.customers c
set grade_id = g.id,
    grade_updated_at = now()
from public.customer_grades g
where g.is_active
  and g.min_total <= c.total_purchase
  and c.grade_id is null
  and not exists (
    select 1 from public.customer_grades g2
    where g2.is_active
      and g2.min_total <= c.total_purchase
      and g2.sort_order > g.sort_order
  );

-- ------------------------------------------------------------
-- ۴) RPC اتمیک شارژ مجموع خرید پس از تحویل سفارش
--    • با گارد purchase_counted=false → هیچ سفارشی دوبار حساب نمی‌شود
--    • گرید فقط وقتی جابه‌جا می‌شود که گریدِ تازه بالاتر باشد (فقط ارتقا)
-- ------------------------------------------------------------
create or replace function public.credit_completed_purchase(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_phone text;
  v_amount bigint;
  v_new_total bigint;
  v_best_id uuid;
  v_best_sort integer;
  v_current_sort integer;
begin
  if p_order_id is null then
    return;
  end if;

  -- ۱) رزرو یک‌باره‌ی سفارش (idempotent) و خواندن مشتری/مبلغ
  update public.orders o
     set purchase_counted = true
   where o.id = p_order_id
     and o.purchase_counted = false
     and o.status = 'delivered'
  returning o.customer_phone, o.subtotal
  into v_phone, v_amount;

  if not found or v_phone is null or v_amount is null or v_amount <= 0 then
    return;
  end if;

  -- ۲) قفل ردیف مشتری و جمع جدید
  select total_purchase into v_new_total
  from public.customers
  where phone = v_phone
  for update;

  if v_new_total is null then
    -- مشتریِ کیف‌پولی با این شماره وجود ندارد (سفارش مهمان) — فقط گارد سفارش مصرف شد
    return;
  end if;
  v_new_total := v_new_total + v_amount;

  -- ۳) بهترین گریدِ عبورکرده + گریدِ فعلی
  select g.id, g.sort_order into v_best_id, v_best_sort
  from public.customer_grades g
  where g.is_active and g.min_total <= v_new_total
  order by g.sort_order desc
  limit 1;

  select gg.sort_order into v_current_sort
  from public.customer_grades gg
  where gg.id = (select grade_id from public.customers where phone = v_phone);

  -- ۴) به‌روزرسانی مجموع خرید + ارتقای فقط-بالا
  update public.customers
     set total_purchase = v_new_total,
         grade_updated_at = now(),
         grade_id = case
           when v_best_id is null then grade_id
           when grade_id is null then v_best_id
           when coalesce(v_current_sort, -1) < v_best_sort then v_best_id
           else grade_id
         end
   where phone = v_phone;
end $$;

-- ------------------------------------------------------------
-- ۵) دسترسی‌ها: RPC برای service role (فراخوانی از سرور) کافی است؛
--    برای اجرای مستقیم توسط ادمینِ لاگین‌شده اجرا مجاز می‌ماند.
-- ------------------------------------------------------------
commit;
