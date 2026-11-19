-- ============ پچ ۵۰-و-الف: زیرساخت پرداخت POS (صندوق‌های نقدی + کارتخوان‌ها) ============
-- فاز ۲ طرح بازطراحی POS — جداول + اتصال دفتر پرداخت + صندوق پیش‌فرض
-- الگوی امنیتی مثل ۵۰-ا: RLS روشن، بدون پالیسی عمومی، دسترسی فقط از سرور

-- ۱) صندوق‌های نقدی
create table if not exists public.cash_registers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  location   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ۲) کارتخوان‌ها
create table if not exists public.pos_devices (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  label      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cash_registers_active_idx on public.cash_registers (is_active);
create index if not exists pos_devices_active_idx on public.pos_devices (is_active);

-- ۳) ثبت صندوق/دستگاه روی ردیف‌های دفتر پرداخت — برای گزارش‌های شیفت (پچ ۵۱)
alter table public.order_payments
  add column if not exists register_id uuid references public.cash_registers(id),
  add column if not exists device_id  uuid references public.pos_devices(id);

-- ۴) صندوق پیش‌فرض — فقط اگر هیچ صندوقی وجود ندارد
insert into public.cash_registers (name, location)
select 'صندوق پیش‌فرض', 'کافه'
where not exists (select 1 from public.cash_registers);

-- ۵) امنیت: فقط service role
alter table public.cash_registers enable row level security;
alter table public.pos_devices enable row level security;

revoke all on public.cash_registers from anon, authenticated;
revoke all on public.pos_devices from anon, authenticated;
