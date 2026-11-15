# پچ ۵۰-هـ-ل (۵۰-هـ-ژ) — تسویهٔ سفارشِ بازِ حضوری + تب بدهی + سرعت پنل مشتری

> تاریخ: 2026-11-15 · پایه: main (پس از ۵۰-هـ-ز / PR #101)
> ⚠️ این پچ **مایگریشن SQL دارد** — قبل از دیپلوی اجرا شود (مرحلهٔ ۱)

## 🐛 مشکلات گزارش‌شده (با اسکرین‌شات‌های 405/406)
1. صفحهٔ جزئیات سفارش حضوری باز می‌شود ولی **هیچ دکمهٔ پرداخت/تسویه‌ای ندارد**
   — چون گیتِ سکشن پرداخت فقط برای روش‌های transfer/online/wallet/partial بود و
   سفارشِ «پرداخت در محل» (cash/card) از آن جا می‌افتاد.
2. سفارشِ بازِ تسویه‌نشده در تب «💸 بدهی‌ها» پنل مشتری **نشان داده نمی‌شد**
   (فیلتر تب بدهی فقط سفارش‌های تحویل‌شده را می‌گرفت).
3. لودینگ پنل مشتری کند است — `/api/customer/orders` (و ۵ روت پرداخت) زنجیرهٔ
   شناسایی مشتری را **سه کوئری پشت‌سرهم** اجرا می‌کنند و روی `device_id_hash`
   / `customer_phone` هم **ایندکسی نیست** → اسکن کامل جدول در هر درخواست.

## ✅ فیکس‌ها

### الف) تسویهٔ سفارشِ بازِ حضوری در صفحهٔ جزئیات — `app/order/[id]/page.tsx`
- شرط جدید `isOpenInPlaceUnpaid`: سفارشِ باز (pending/confirmed/preparing/ready)
  با روش cash/card که پرداخت نشده (unpaid/failed).
- `showPaymentSection` آن را هم شامل می‌شود → همان UI کامل روش‌ها: 👛 کیف پول،
  💳 پرداخت آنلاین درگاه، 🏦 واریز به حساب با رسید، 💵 پرداخت در محل.
- با باز شدن صفحه، **انتخابِ روش مستقیم باز می‌شود** (مثل partial) — بعد از
  «بازگشت» هم دکمهٔ «🔀 تغییر روش پرداخت» دسترس‌پذیر است.
- بج سفارش: «⏱ پرداخت نشده — قابل تسویه از همین صفحه».
- سفارش تحویل‌شدهٔ تسویه‌نشده همان سکشن بدهی قبلی را دارد (درگاه + کیف پول +
  ارسال رسید) که با APIهای پچ ۵۰-هـ-ز حالا برای سفارش حضوری هم کار می‌کند.

### ب) تب بدهی — `app/my-orders/MyOrdersClient.tsx`
- قانون جدید: `payment_status !== 'paid'` و (تحویل‌شده **یا** سفارشِ باز) →
  در لیست بدهی‌ها می‌آید و در «مجموع مبلغ تسویه‌نشده» هم حساب می‌شود.
- سفارش لغو‌شده همچنان در بدهی نمی‌آید؛ رسیدِ در انتظارِ تأیید هم بدهی می‌ماند
  (تا مدیر تأیید نکرده تسویه نشده است).

### ج) سرعت — `lib/orders/owner.ts` + مایگریشن ایندکس
- `getDeviceCustomerPhone`: سه کوئری (سفارشِ دستگاه / customers / عضو سازمانی)
  حالا با `Promise.all` **موازی** اجرا می‌شوند → به‌جای ۳ رفت‌وبرگشت پشت‌سرهم،
  ۱ رفت‌وبرگشت به اندازهٔ کندترین. این هِلپر در ۵ روت پرداخت + لیست سفارش‌ها
  صدا زده می‌شود، پس همه سریع‌تر می‌شوند.
- مایگریشن `20261116_orders_ownership_indexes.sql`: چهار ایندکس روی
  `orders(device_id_hash)`، `orders(customer_phone)`،
  `customers(device_id_hash)`، `organization_members(device_id_hash)` + ANALYZE.

**اجرا:** Supabase → SQL Editor → محتوای `supabase/migrations/20261116_orders_ownership_indexes.sql` → Run

## امنیت
- هیچ دسترسی جدیدی اضافه نشده — همان دسترسی دوگانهٔ پچ ۵۰-هـ-ز؛ فقط UI با
  APIهایی که از قبل باز شده‌اند هم‌تراز شد.
- تغییر روش/ارسال رسید/پرداخت با کیف پول همان گاردهای قبلی (بدون رسیدِ در
  انتظار، شمارهٔ کیف پول = شمارهٔ سفارش، سفارشِ باز) را دارند.

## اجرا
```powershell
# ۱) SQL: محتوای supabase/migrations/20261116_orders_ownership_indexes.sql در SQL Editor
# ۲) کد:
git checkout main
git pull origin main
git checkout -b feat/patch-50e-l-open-inplace-settlement-and-perf
# patch-50e-l-open-inplace-settlement-and-perf.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-50e-l-open-inplace-settlement-and-perf.patch
Remove-Item patch-50e-l-open-inplace-settlement-and-perf.patch
git add -A
git commit -m "Customer 50e-l: settle open in-place (POS) orders from details page, open unsettled orders in debt tab, parallel phone chain + ownership indexes"
git push -u origin feat/patch-50e-l-open-inplace-settlement-and-perf
```
PR → Merge → `git checkout main && git pull` و Deploy

## تست
1. سفارش حضوریِ باز برای عضو از POS → جزئیات در پنل مشتری → کادر «💳 پرداخت
   سفارش» با انتخاب روش باز باشد → «کارت‌به‌کارت» → ارسال رسید → «در انتظار
   تأیید مدیر» → تأیید از POS/ادمین → تسویه شود
2. کیف پول و درگاه روی همان سفارش حضوری تست شود (کامل و ترکیبی)
3. تب «💸 بدهی‌ها» → سفارشِ بازِ تسویه‌نشده دیده شود + مجموع درست باشد؛ بعد از
   تسویه از لیست بدهی خارج شود
4. سفارش تحویل‌شدهٔ بدهی‌دار → سکشن بدهی با درگاه/کیف پول/رسید کار کند
5. سرعت لود پنل مشتری بعد از اجرای SQL محسوس‌تر شود (ایندکس‌ها + کوئری موازی)
6. سفارش آنلاینِ قبلی: جزئیات و تب‌ها مثل قبل (رفتار تغییر نکرده)
