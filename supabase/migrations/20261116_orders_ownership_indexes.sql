-- ============================================================
-- پچ ۵۰-هـ-ژ — ایندکس‌های مالکیت سفارش/مشتری (سرعت پنل مشتری)
-- کوئری‌های زنجیرهٔ شناسایی مشتری (lib/orders/owner.ts) و لیست سفارش‌های پنل
-- روی device_id_hash / customer_phone جستجو می‌کنند؛ بدون ایندکس = اسکن کامل
-- جدول در هر درخواست → کندی پنل مشتری.
-- اجرا در: Supabase Dashboard → SQL Editor → Run — idempotent است.
-- ============================================================

create index if not exists idx_orders_device_id_hash
  on public.orders (device_id_hash);

create index if not exists idx_orders_customer_phone
  on public.orders (customer_phone);

create index if not exists idx_customers_device_id_hash
  on public.customers (device_id_hash);

create index if not exists idx_org_members_device_id_hash
  on public.organization_members (device_id_hash);

-- به‌روزرسانی آماری برنامه‌ریز برای انتخاب plans بهتر
analyze public.orders;
analyze public.customers;
analyze public.organization_members;

-- [تایید]
select indexname from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_orders_device_id_hash',
    'idx_orders_customer_phone',
    'idx_customers_device_id_hash',
    'idx_org_members_device_id_hash'
  )
order by 1;
