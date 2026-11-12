# پچ ۴۹-ج — فاز دوم پشتیبان‌گیری: ذخیرهٔ ابری + تاریخچهٔ سروری + دانلود دوباره + فشرده‌سازی تصاویر

پیش‌نیاز: پچ ۴۹-ب مرج شده (PR #83). **یک migration SQL** باید اجرا شود (اختیاری ولی توصیه‌شده):
فایل `20261112_backup_history.sql` در Supabase → SQL Editor (فقط ADD COLUMN امن است).

## چه چیزی اضافه شد

### ۱) ذخیرهٔ خودکار نسخهٔ کامل روی سرور ☁️
- در مودال پشتیبان‌گیری چک‌باکس «☁️ ذخیرهٔ خودکار نسخهٔ کامل روی سرور» (پیش‌فرض روشن)
- پس از هر بکاپ **کامل**، کلاینت به `POST /api/admin/backup/store` خبر می‌دهد؛ سرور خودش
  کل payload را می‌سازد (بدون محدودیت حجم بدنهٔ درخواست Vercel) و در **bucket خصوصی
  «backups»** آپلود می‌کند (در نبود bucket، خودکار ساخته می‌شود — idempotent)
- نگهداشت: فقط **۱۰ نسخهٔ اخیر** می‌ماند و قدیمی‌ها حذف می‌شوند
- بکاپ ناقص هرگز روی سرور ذخیره نمی‌شود
- نتیجه در همان مودال: «☁️ نسخه روی سرور ذخیره شد: …» + خطای واضح در صورت شکست
  (شکست ذخیرهٔ ابری، بکاپ محلی را خراب نمی‌کند)

### ۲) کارت «☁️ نسخه‌های ذخیره‌شده روی سرور» — دانلود دوباره
- `GET /api/admin/backup/cloud`: فهرست نسخه‌ها + **URL امضاشدهٔ یک‌ساعته** برای هرکدام
- دکمهٔ «↻ بروزرسانی» + دانلود مستقیم هر نسخه از همان کارت (بدون نیاز به فایل محلی)

### ۳) تاریخچهٔ سروری (با migration)
- پس از ذخیرهٔ ابری، مشخصات نسخه در ستون جدید `backup_history` جدول `settings` (id=1)
  ثبت می‌شود (حداکثر ۱۰ مورد)
- اگر migration اجرا نشده باشد: ذخیرهٔ ابری کار می‌کند، فقط ثبت تاریخچه بی‌سروصدا رد و
  در UI پیام راهنما نشان داده می‌شود
- تاریخچهٔ محلی هم ارتقا یافت: ردیف بکاپ ابری با نشان **☁️** در کارت تاریخچه و hero

### ۴) فشرده‌سازی خودکار تصاویر محصول — ریشه‌کن کردن ردِ >۳MB
- کشف: دو مسیر آپلود وجود داشت — `/api/upload` (فشرده‌سازی با sharp داشت) ولی فرم محصولات
  از server action به `uploadProductImage` می‌رفت که **فایل خام** آپلود می‌کرد؛ همین منبع
  آن دو تصویر ردشده در بکاپ بود
- فیکس: `app/admin/products/actions.ts` حالا مثل `/api/upload` فشرده می‌کند
  (sharp: حداکثر ۱۲۰۰×۱۲۰۰، WebP کیفیت ۸۵) → تصاویر جدید عملاً زیر ~۲۰۰KB می‌مانند
- تصاویر قدیمیِ درشت‌تر همچنان با «علت حجم» در بکاپ گزارش می‌شوند (سقف ۳MB سر جایش است)

## معماری
- `lib/backup-core.ts` (جدید، server-only): هستهٔ مشترک — fetchAllRows / collectStorage /
  storageTotals / buildFullPayload / contentTypeFor — که GET کامل و store از آن مشترک استفاده می‌کنند
- `lib/backup-sections.ts`: + `BACKUP_TABLES` (انتقال از route) و `BACKUP_BUCKET='backups'`
- `app/api/admin/backup/route.ts`: بازنویسی تمیز با import از هسته؛ رفتار GET/POST دست‌نخورده
- `app/api/admin/backup/store/route.ts` (جدید) · `app/api/admin/backup/cloud/route.ts` (جدید)
- `app/admin/backup/BackupClient.tsx` + CSS (`.backup-cloud-*` با توکن‌ها → دارک خودکار)
- `app/admin/products/actions.ts`: sharp

## دروازه‌ها
verifier CSS ✓ · `tsc --noEmit` ✓ · `next build` تولیدی ✓ (سه مسیر backup/cloud/store خروجی گرفت)
· apply-check + تایپ پس از اعمال ✓

## اعمال (PowerShell)
```powershell
git checkout main && git pull
git checkout -b feat/patch-49c-backup-cloud-store
git apply --ignore-whitespace --verbose patch-49c-backup-cloud-store.patch
# صحت اعمال — انتظار:
(Select-String -Path "lib\backup-core.ts" -Pattern "buildFullPayload").Count                          # >= 2
(Test-Path "app\api\admin\backup\store\route.ts")                                                     # True
(Test-Path "app\api\admin\backup\cloud\route.ts")                                                     # True
(Select-String -Path "app\admin\products\actions.ts" -Pattern "sharp").Count                          # >= 2
# سپس migration (یک‌بار): فایل 20261112_backup_history.sql در Supabase SQL Editor اجرا شود
git add -A
git commit -m "feat(admin): patch 49c - cloud backup store with server history, re-download list, sharp image compression"
git push -u origin feat/patch-49c-backup-cloud-store
```
سپس PR و merge: `https://github.com/hadiassadi/cafe-park-menu/compare/main...feat/patch-49c-backup-cloud-store`

## تست بعد از merge (کاربر)
1. `git checkout main` ← `git pull` ← `npm run dev` ← `Ctrl+F5` ← اجرای SQL migration
2. پشتیبان‌گیری → مودال: چک‌باکس ☁️ روشن → پس از تیک‌های کامل، خط «☁️ نسخه روی سرور ذخیره شد…»
3. کارت «نسخه‌های روی سرور»: نسخه دیده شود → «⬇️ دانلود» فایل بکاپ را بدهد
4. hero و تاریخچه: نشان ☁️ روی بکاپ ابری
5. یک محصول با عکس بزرگ (مثلاً ۵MB) ذخیره کنی → عکس فشرده شود و در بکاپ بعدی ردشده نداشته باشی
6. چک‌باکس را خاموش کنی → بکاپ بدون پیام ابری، فقط دانلود محلی
7. حالت شب: کارت‌ها و مودال خوانا
