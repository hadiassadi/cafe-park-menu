-- ============================================================
-- پچ ۲۶ — سقف شارژ کارت‌به‌کارت (کف از قبل wallet_charge_min بود)
-- اجرا در: Supabase Dashboard → SQL Editor → Run
-- idempotent است؛ اجرای مکرر بی‌ضرر.
-- ============================================================

alter table public.settings
  add column if not exists wallet_charge_max bigint not null default 10000000;
