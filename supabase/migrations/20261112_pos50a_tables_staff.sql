-- ============ پچ ۵۰-ا: زیرساخت POS (میزها + کارکنان + تخفیف دستی) ============

-- ۱) هزینهٔ پیش‌فرض رزرو هر میز (مطابق واحد قیمت‌های منو) — منطق رزرو در پچ ۵۳ وصل می‌شود
alter table public.tables
  add column if not exists reservation_fee bigint not null default 0;

comment on column public.tables.reservation_fee is 'هزینهٔ پیش‌فرض رزرو؛ در هر رزرو قابل تغییر است';

-- ۲) زیرساخت نقش‌های کارکنان — فعلاً فقط جدول؛ UI سطح دسترسی در پچ‌های بعدی
create table if not exists public.staff_members (
  id           bigint generated always as identity primary key,
  full_name    text not null,
  role         text not null default 'staff',  -- owner | manager | cashier | waiter | kitchen | staff
  phone        text,
  auth_user_id uuid,
  is_active    boolean not null default true,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists staff_members_active_idx on public.staff_members (is_active);

-- ۳) تخفیف دستی سفارش — منطق مصرف در پچ ۵۱
alter table public.orders
  add column if not exists manual_discount bigint not null default 0;

-- ۴) الگوی امنیتی پروژه: RLS روشن + بدون پالیسی عمومی + دسترسی فقط از سرور (service role)
alter table public.staff_members enable row level security;

revoke all on public.staff_members from anon, authenticated;
