-- ============ پچ ۵۰-و-ب: مالک صندوق + حساب‌های بانکی (فاز ۲، بخش ۲) ============
-- ۱) هر صندوق می‌تواند مالک (کاربر ادمین) داشته باشد — صندوق پیش‌فرض هر اپراتور؛
--    مدیر به همهٔ صندوق‌ها دسترسی دارد و مجموع آن‌ها = موجودی کل نقدی
alter table public.cash_registers
  add column if not exists owner_id uuid;

create index if not exists cash_registers_owner_idx
  on public.cash_registers (owner_id);

comment on column public.cash_registers.owner_id is
  'مالک صندوق (auth.users) — برای پیش‌فرض‌شدن در تسویهٔ همان اپراتور و گزارش شیفت';

-- ۲) کارتخوان‌ها → حساب‌های بانکی با مشخصات کامل + تیک «استفاده به‌عنوان کارتخوان»
--    نام جدول pos_devices حفظ شد تا FK موجود order_payments.device_id نشکند؛
--    فقط ردیف‌هایی که is_card_reader=true باشند در تسویه به‌عنوان کارتخوان می‌آیند
alter table public.pos_devices
  add column if not exists bank_name text,
  add column if not exists iban text,
  add column if not exists account_number text,
  add column if not exists card_number text,
  add column if not exists is_card_reader boolean not null default true;

comment on table public.pos_devices is
  'حساب‌های بانکی؛ ردیف‌های is_card_reader=true در تسویه POS به‌عنوان کارتخوان انتخاب می‌شوند';

-- ردیف‌های قبلی (کارتخوان‌های ۵۰-و-الف) به‌عنوان کارتخوان می‌مانند — default true
