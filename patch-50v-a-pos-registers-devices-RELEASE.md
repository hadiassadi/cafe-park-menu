# پچ ۵۰-و-الف — زیرساخت پرداخت POS: صندوق‌های نقدی + کارتخوان‌ها (فاز ۲، بخش ۱)

> تاریخ: 2026-11-19 · پایه: main (پس از ۵۰-هـ-ع / PR #114) · ⚠️ اول SQL را اجرا کن، بعد Deploy

## این پچ چیست
بخش اول «فاز ۲ — زیرساخت پرداخت POS» از طرح بازطراحی: تعریف صندوق‌های نقدی و
کارتخوان‌ها، مدیریتشان در تنظیمات پرداخت، و انتخاب‌شان هنگام تسویه در POS —
ثبت روی دفتر پرداخت (`order_payments`) تا گزارش‌های شیفت (پچ ۵۱) از همین مبنا
حساب شوند.

## ⚠️ ترتیب اجرا
1. **اول** SQL را در Supabase اجرا کن (`patch-50v-a-pos-registers-devices.sql`
   — همان محتوای `supabase/migrations/20261119_pos50v_registers_devices.sql`)
2. بعد Merge و Deploy

اگر کد قبل از SQL دیپلوی شود: صفحهٔ تنظیمات «خطای پایگاه داده» در دو بخش جدید
نشان می‌دهد و POS بدون صندوق/دستگاه مثل قبل کار می‌کند (انتخاب اختیاری است) —
خرابی ندارد ولی طبعاً اول SQL بهتر است.

## تغییرات

### 1) مایگریشن — `20261119_pos50v_registers_devices.sql`
- جدول `cash_registers(id, name, location, is_active, created_at)` — صندوق‌های نقدی
- جدول `pos_devices(id, name, label, is_active, created_at)` — کارتخوان‌ها
- ستون‌های `register_id` / `device_id` روی `order_payments` (nullable + FK)
- صندوق پیش‌فرض «صندوق پیش‌فرض» اگر هیچ صندوقی نباشد
- الگوی امنیتی پروژه: RLS روشن + revoke از anon/authenticated (فقط service role)

### 2) تنظیمات پرداخت (`/admin/settings/payment`)
- دو بخش جدید «🧰 صندوق‌های نقدی» و «📟 کارتخوان‌ها»: افزودن (نام + محل/برچسب)
  و فعال/غیرفعال کردن. مستقل از کلید «سیستم پرداخت».
- Server actions جدید: list/create/update برای هر دو (assertAdmin).

### 3) API پرداخت POS — `POST /api/admin/orders/[id]/payment`
- پارامترهای اختیاری `register_id` / `device_id` (باید UUID فعال باشند وگرنه خطا)
- بعد از ثبت ردیف دفتر (RPC موجود دست‌نخورده)، صندوق/دستگاه به همان ردیف
  متصل می‌شود؛ خطای اتصال فقط لاگ می‌شود و پرداخت خراب نمی‌شود.

### 4) مودال پرداخت مشترک (`AdminSplitPayment` — POS و پنل سفارش‌ها)
- با تیک «نقدی»: وقتی بیش از یک صندوق فعال است، چیپ‌های صندوق زیر ردیف می‌آید
  (پیش‌فرض اولین)؛ با تیک «کارت‌خوان»: چیپ‌های دستگاه.
- با یک صندوق/دستگاه، همان خودکار ثبت می‌شود — بدون گام اضافه.

### 5) مودال «روش پرداخت» ثبت فوری در POS (`payChoose`)
- کلیک «💵 نقدی» / «💳 کارت‌خوان» وقتی بیش از یک گزینه فعال باشد → چیپ‌های
  انتخاب + دکمهٔ «✅ تأیید و ثبت سفارش»؛ در غیر این صورت مثل قبل فوری ثبت می‌شود.

## اجرا
```powershell
git checkout main
git pull origin main
git checkout -b feat/patch-50v-a-pos-registers-devices
# patch-50v-a-pos-registers-devices.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-50v-a-pos-registers-devices.patch
# SQL را در Supabase اجرا کن (SQL Editor) — قبل از Deploy:
# محتوای supabase/migrations/20261119_pos50v_registers_devices.sql
Remove-Item patch-50v-a-pos-registers-devices.patch
git add -A
git commit -m "50v-a: POS payment infrastructure phase 2 part 1 — cash registers + card readers (tables, settings CRUD, instruments API, settlement selection)"
git push -u origin feat/patch-50v-a-pos-registers-devices
```
PR → Merge → `git checkout main && git pull` و Deploy

## تست
1. تنظیمات پرداخت: یک صندوق دوم (مثلاً «صندوق بار») + یک کارت‌خوان بساز
2. POS → پرداخت و ثبت → 💵 نقدی → چیپ انتخاب صندوق می‌آید → تأیید → سفارش
   تسویه‌شده با صندوق انتخابی ثبت می‌شود (در دفتر: order_payments.register_id)
3. کارت‌خوان: فقط یک دستگاه فعال → بدون گام اضافه ثبت می‌شود
4. مودال پرداخت ترکیبی سفارش موجود (ردیف نقدی/کارت‌خوان): چیپ‌های انتخاب
5. غیرفعال کردن صندوق در تنظیمات → دیگر در POS دیده نمی‌شود؛ ارسال id غیرفعال
   به API → خطای «صندوق انتخابی معتبر نیست»
6. پرداخت‌های مشتری (پنل مشتری/درگاه) بدون تغییر کار می‌کنند
