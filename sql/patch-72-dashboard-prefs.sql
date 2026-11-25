-- ═══════════════════════════════════════════════════════════════
-- پچ ۷۲ — داشبورد قابل تنظیم برای هر کاربر
-- جدول تنظیمات داشبورد: هر کاربر فقط چیدمان خودش را ذخیره می‌کند
-- اجرا: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.dashboard_prefs (
  user_id uuid primary key,
  widgets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS روشن ولی بدون policy: هیچ کلاینت‌ sideای مستقیم نمی‌خواند/نمی‌نویسد؛
-- فقط سرور با service_role (از طریق API پنل) دسترسی دارد.
alter table public.dashboard_prefs enable row level security;

comment on table public.dashboard_prefs is
  'پچ ۷۲: چیدمان داشبورد هر کاربر — widgets = آرایهٔ شناسهٔ ویجت‌ها به ترتیب اولویت';
