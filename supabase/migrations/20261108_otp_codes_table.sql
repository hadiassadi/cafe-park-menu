-- جدول کدهای یک‌بارمصرف برای ورود با شماره موبایل (کاوه‌نگار)
-- نکته: فقط service-role به این جدول دسترسی دارد؛ RLS کاملاً بسته است (هم‌سو با سیاست امنیتی فعلی)

create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone_hash text not null,
  code_hash text not null,
  attempts int not null default 0,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists otp_codes_phone_idx
  on public.otp_codes (phone_hash, created_at desc);

alter table public.otp_codes enable row level security;
alter table public.otp_codes force row level security;
revoke all on public.otp_codes from anon, authenticated;

-- تنظیمات پیامک در جدول settings (کنار تنظیمات پرداخت)
alter table public.settings add column if not exists sms_api_key text;
alter table public.settings add column if not exists sms_sender text;
alter table public.settings add column if not exists sms_otp_template text default 'cafe-park-otp';
