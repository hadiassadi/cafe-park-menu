-- 🎯 پچ ۷۴ — حالت قفل چیدمان داشبورد
-- ستون locked به جدول تنظیمات داشبورد اضافه می‌شود:
--   false (پیش‌فرض) = کاربر می‌تواند بخش‌ها را ببندد، جابه‌جا کند و تیک بزند
--   true            = چیدمان قفل است؛ نه دکمهٔ ✕ روی تب‌هاست نه جابه‌جایی
-- اجرا در SQL Editor سوپاباس — فقط یک خط، بدون خطر برای داده‌های فعلی.
alter table public.dashboard_prefs
  add column if not exists locked boolean not null default false;
