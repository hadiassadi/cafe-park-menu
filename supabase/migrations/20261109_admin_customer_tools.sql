-- پچ ۲۳ — ابزارهای مدیریتی مشتریان: ردگیری دستگاه دعوت‌شده + ابزار ویرایش/حذف ثبت‌نام
-- اجرا: Supabase SQL Editor (idempotent)

-- دستگاهی که دعوت‌نامه را مصرف کرده: هش (برای تطبیق) + برچسب خوانا (برای نمایش به مدیر)
alter table public.registration_invites add column if not exists used_device_info text;
alter table public.registration_invites add column if not exists used_device_hash text;

-- آخرین دستگاه شناخته‌شده‌ی مشتری (برای نمایش در پنل مدیریت مشتریان)
alter table public.customers add column if not exists device_info text;
