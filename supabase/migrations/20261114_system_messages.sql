-- ============================================================
-- پچ ۳۵ — پیام‌های سیستم (لحن مرجع: ایرانی اصیل و گرم)
--   • settings.welcome_enabled   : سوییچ نمایش چیپ هویت + مودال خوش‌آمد در منو
--   • settings.welcome_title     : عنوان پیام (پیش‌فرض: «درود بر شما»)
--   • settings.welcome_body      : متن پیام — {name} با نام کوچک مشتری جایگزین می‌شود
--   • settings.welcome_image_url : تصویر/گیف سفیر برند (اختیاری)
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- ============================================================

begin;

alter table public.settings
  add column if not exists welcome_enabled boolean not null default true;

alter table public.settings
  add column if not exists welcome_title text not null default 'درود بر شما';

alter table public.settings
  add column if not exists welcome_body text not null
  default 'درود بر شما، {name} عزیز! خوش آمدید — خوشحالیم که دوباره مهمان کافه پارک هستیم.';

alter table public.settings
  add column if not exists welcome_image_url text;

commit;
