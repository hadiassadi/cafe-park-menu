# پچ ۵۰-هـ-ل — فیکس تست ۵۰-هـ-گ: ثبات فیلتر تاریخ، لیبل قرمز تسویه‌نشده، صفحهٔ سفارش ترکیبی

> تاریخ: 2026-11-16 · پایه: main (پس از ۵۰-هـ-گ / PR #107) · بدون مایگریشن SQL

## ۱) ⏱ فیلتر تاریخ لیست POS دیگر خودکار ریست نمی‌شود
- علت: پولر ۶۰ ثانیه‌ای لیست، تابع `loadOrders` رندرِ اول را صدا می‌زد
  (closure کهنه) → هر دقیقه لیست فیلترشده با لیست روزانه overwrite می‌شد.
- فیکس: مقدارهای صفحه/از/تا در `useRef` نگه‌داری می‌شوند و هر فراخوانی
  (پولر، ثبت سفارش، …) همیشه فیلتر جاری را حفظ می‌کند.

## ۲) 🔴 لیبل قرمز «💳 تسویه نشده» در لیست حضوری
- سفارش‌های بدون هیچ پرداختی حالا لیبل قرمز «💳 تسویه نشده» دارند
  (کنار لیبل‌های سبزِ «تسویه شده» و نارنجیِ «مانده X») — برای سفارش لغوشده نمی‌آید.

## ۳) 🧩 صفحهٔ سفارشِ ساخته‌شده با «پرداخت ترکیبی» (باگ تصویر ۴۰۸)
- علت: شرط نمایش بخش پرداخت (`showPaymentSection`) برای روش `split` هیچ
  تطابقی نداشت → کل بخش پرداخت از صفحه حذف می‌شد و صفحه بعد از اطلاعات
  تماس «بریده» به نظر می‌رسید.
- فیکس‌ها:
  - روش `split` شرط نمایش بخش پرداخت است (وقتی سفارش پرداخت‌نشده است).
  - بعد از لود سفارشِ ترکیبی، چیپ‌های انتخاب روش به‌صورت پیش‌فرض باز می‌شوند
    (شامل چیپ 🧩 ترکیبی برای برگشتن به پنل تقسیم مبلغ).
  - ورود مستقیم از checkout با `?pay=split` همچنان پنل ترکیبی را باز می‌کند.

## اجرا
```powershell
git checkout main
git pull origin main
git checkout -b feat/patch-50e-l-filter-stability-unpaid-badge-split-order-fix
# patch-50e-l-filter-stability-unpaid-badge-split-order-fix.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-50e-l-filter-stability-unpaid-badge-split-order-fix.patch
Remove-Item patch-50e-l-filter-stability-unpaid-badge-split-order-fix.patch
git add -A
git commit -m "Admin 50e-l: keep list filter across auto-refresh, red unpaid badge, show payment section for split-method orders"
git push -u origin feat/patch-50e-l-filter-stability-unpaid-badge-split-order-fix
```
PR → Merge → `git checkout main && git pull` و Deploy

## تست
1. لیست POS: بازهٔ تاریخ را انتخاب کنید و ~۱ دقیقه صبر کنید — لیست فیلتر می‌ماند
2. سفارش بدون پرداخت در لیست: لیبل قرمز «💳 تسویه نشده» دیده می‌شود
3. checkout آنلاین: 🧩 ترکیبی → ثبت → صفحهٔ سفارش با بخش پرداخت (پنل ترکیبی) باز می‌شود
4. همان سفارش را بعداً از «سفارش‌های من» باز کنید — بخش پرداخت با چیپ‌ها نمایش داده می‌شود
