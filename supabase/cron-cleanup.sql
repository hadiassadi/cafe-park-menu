-- ═══════════════════════════════════════════════════════════
-- پاکسازی خودکار سفارش‌های قدیمی با pg_cron
-- این فایل را یک بار در Supabase → SQL Editor اجرا کنید
-- ═══════════════════════════════════════════════════════════

-- ⚠️ پیش‌نیاز: از داشبورد Supabase → Database → Extensions
--    گزینه pg_cron را Enable کنید.

-- ۱. فعال‌سازی extension (اگر قبلاً فعال نشده)
create extension if not exists pg_cron with schema extensions;

-- ۲. افزودن فیلدهای تنظیمات به جدول settings
alter table settings
  add column if not exists auto_cleanup_enabled boolean default true,
  add column if not exists auto_cleanup_days int default 90;

-- ۳. تابع پاکسازی سفارش‌های قدیمی
create or replace function cleanup_old_orders()
returns json
language plpgsql
security definer
as $$
declare
  v_enabled boolean;
  v_days int;
  v_deleted int;
  v_cutoff timestamptz;
begin
  -- خواندن تنظیمات از جدول settings
  select auto_cleanup_enabled, auto_cleanup_days
  into v_enabled, v_days
  from settings
  where id = 1;

  -- اگر غیرفعال بود، هیچ کاری نکن
  if not coalesce(v_enabled, false) then
    return json_build_object(
      'success', true,
      'skipped', true,
      'reason', 'auto_cleanup_disabled'
    );
  end if;

  v_days := coalesce(v_days, 90);
  v_cutoff := now() - (v_days || ' days')::interval;

  -- پاکسازی: فقط سفارش‌های تمام‌شده یا لغو‌شده
  -- (سفارش‌های در جریان رو دست نمی‌زنیم)
  delete from orders
  where created_at < v_cutoff
    and status in ('delivered', 'cancelled');

  get diagnostics v_deleted = row_count;

  return json_build_object(
    'success', true,
    'skipped', false,
    'deleted', v_deleted,
    'cutoff', v_cutoff,
    'days_kept', v_days,
    'ran_at', now()
  );
end;
$$;

-- ۴. حذف job قبلی اگر وجود داره (برای اجرای مجدد این فایل)
select cron.unschedule('auto-cleanup-orders')
where exists (
  select 1 from cron.job where jobname = 'auto-cleanup-orders'
);

-- ۵. زمان‌بندی: هر روز ساعت ۳ بامداد
select cron.schedule(
  'auto-cleanup-orders',
  '0 3 * * *',
  $$select cleanup_old_orders()$$
);

-- ═══════════════════════════════════════════════════════════
-- دستورات تست و بررسی وضعیت:
-- ═══════════════════════════════════════════════════════════

-- ✅ تست دستی (همین الان اجرا کن)
-- select cleanup_old_orders();

-- ✅ لیست job های فعال
-- select jobid, jobname, schedule, command, active from cron.job;

-- ✅ لاگ آخرین اجراها
-- select jobid, status, return_message, start_time, end_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'auto-cleanup-orders')
-- order by start_time desc
-- limit 10;

-- ✅ غیرفعال کردن موقت
-- update settings set auto_cleanup_enabled = false where id = 1;

-- ✅ حذف کامل job
-- select cron.unschedule('auto-cleanup-orders');