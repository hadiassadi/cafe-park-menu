-- ===== پچ ۶۰: لیست دلخواه ماژول‌ها برای هر کاربر پنل =====
-- ⚠️ در Supabase → SQL Editor → کل این فایل را paste کن → Run
--
-- allowed_paths: آرایه‌ای از مسیرهای ماژول‌هایی که مدیر برای این کاربر تیک زده.
--   '[]' (خالی) = «پیش‌فرض نقش» — ماتریس پچ ۵۶ حاکم است (رفتار فعلی)
--   غیرخالی    = فقط همین ماژول‌ها در منو دیده می‌شوند و گیت سرور هم فقط
--                همین‌ها را باز می‌کند (داشبورد همیشه باز است)

alter table public.admin_operator_profiles
  add column if not exists allowed_paths jsonb not null default '[]'::jsonb;

-- 🎯 پچ ۶۰-ب: ستون is_active هم روی این جدول لازم است (قبلاً فقط روی
-- staff_members بود) — پروکسی با select کامل بدون این ستون خطا می‌داد و
-- لاگین کاربران پنل به ?denied=1 می‌خورد. اجرای اینجا هر دو ستون را تضمین می‌کند
alter table public.admin_operator_profiles
  add column if not exists is_active boolean not null default true;

-- کنترل نهایی — باید هر دو ستون را نشان بدهد
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'admin_operator_profiles'
   and column_name in ('allowed_paths', 'is_active')
 order by column_name;
