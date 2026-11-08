-- پچ ۲۴ — آرشیو/بازگردانی مشتری + حذف کامل کنترل‌شده
-- اجرا: Supabase SQL Editor (idempotent)

-- آرشیو مشتری: ستون زمان آرشیو شدن (null = فعال)
-- اثر آرشیو: verification_status به unverified برمی‌گردد → نشست و کیف پول فوراً غیرفعال می‌شود،
-- از لیست مشتریان فعال مخفی می‌شود و با ثبت‌نام دعوتیِ دوباره، خودش زنده می‌شود.
alter table public.customers add column if not exists archived_at timestamptz;

-- کلید امنیتی: اجازه‌ی حذف کامل ثبت‌نام مشتری (فقط از بخش آرشیو)
alter table public.settings add column if not exists admin_allow_delete_customers boolean not null default true;
