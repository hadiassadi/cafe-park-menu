# پچ ۵۰-هـ-ع — رساندن سفارش نهایی‌شدهٔ مشتری به پنل مدیر

> تاریخ: 2026-11-19 · پایه: main (پس از ۵۰-هـ-ص / PR #113) · بدون مایگریشن SQL

## ریشهٔ اصلی «سفارش برای مدیر ارسال نمیشه»
کوئری صفحهٔ «پنل سفارش‌ها» (app/admin/orders/page.tsx) سفارش‌ها را با فیلتر
`.or()` می‌گرفت که فقط این‌ها را شامل می‌شد:
`payment_method ∈ (cash,card)` یا `payment_method = null` یا
`payment_status = paid` یا (pending_review + رسید).
سفارشِ پرداخت ترکیبی با «پرداخت در محل» یعنی `payment_method='split'` +
`payment_status='unpaid'` → **به هیچ عنوان وارد پنل مدیر نمی‌شد** (هم در
۵۰-هـ-ص با status=confirmed و هم قبل‌تر با pending).
روی صفحهٔ POS هم بج/بوق «در انتظار تأیید آنلاین» فقط سفارش‌های pending را
می‌شمرد و بعد از نهایی‌سازی (confirmed) سفارش از دید خارج می‌شد.

## تغییرات

### 1) `app/admin/orders/page.tsx` — ریشهٔ اصلی
- فیلتر `.or()` اضافه شد: `payment_status.eq.partial` و
  `customer_confirmed.eq.true` — سفارش‌های نهایی‌شدهٔ مشتری و پرداخت‌های
  ترکیبیِ بخشی‌پرداخت‌شده حالا به پنل سفارش‌ها می‌آیند (درخواست‌های پرداختِ
  رهاشدهٔ مشتری همچنان پنهان می‌مانند).
- لیست server-render است و با router.refresh تازه می‌شود — همان کوئری.

### 2) `app/admin/orders/OrdersManager.tsx`
- تب «در انتظار» (پیش‌فرض) + شمارندهٔ آن: علاوه بر pending، سفارش‌های
  `confirmed + customer_confirmed + تسویه‌نشده` هم می‌آیند.
- بج سبز روی کارت سفارش: «✅ مشتری سفارش را نهایی کرد — آمادهٔ شروع آماده‌سازی».

### 3) صفحهٔ POS (`app/admin/orders/new/NewOrderClient.tsx` + `recent` API)
- بج «📱 در انتظار تأیید آنلاین» → «📱 سفارش آنلاین جدید» و شمارش آن +
  بوقِ سفارش جدید حالا شامل نهایی‌شده‌های مشتری است (confirmed +
  customer_confirmed + تسویه‌نشده).
- تشخیص سفارش پنل مشتری: `source !== 'admin'` یا وجود `device_id_hash`
  (سفارش POS هش دستگاه ندارد) — مستقل از مقدار پیش‌فرض ستون source.
- `recent` API ستون‌های `customer_confirmed` و `device_id_hash` را برمی‌گرداند.

## اجرا
```powershell
git checkout main
git pull origin main
git checkout -b feat/patch-50e-ghain-finalized-orders-admin-visibility
# patch-50e-ghain-finalized-orders-admin-visibility.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-50e-ghain-finalized-orders-admin-visibility.patch
Remove-Item patch-50e-ghain-finalized-orders-admin-visibility.patch
git add -A
git commit -m "50e-ghain: finalized customer orders reach admin — OrdersManager query includes customer_confirmed/partial split orders, pending tab + POS badge/chime include finalized orders"
git push -u origin feat/patch-50e-ghain-finalized-orders-admin-visibility
```
PR → Merge → `git checkout main && git pull` و Deploy

## تست
1. عضو: ترکیبی → «کل مبلغ» نقدی در محل → ثبت/ارسال به کافه → صفحهٔ مشتری بنر سبز
2. پنل سفارش‌ها (مدیر): سفارش در تب پیش‌فرض «در انتظار» دیده می‌شود با بج سبز
   «مشتری سفارش را نهایی کرد» + بج «ترکیبی 🧩 — پرداخت نشده»
3. صفحهٔ POS: بج «📱 سفارش آنلاین جدید: ۱» + بوق (اگر بوق روشن باشد)
4. درخواست پرداخت آنلاینِ رهاشده (بدون تأیید مشتری) همچنان در پنل نمی‌آید
5. سفارش حضوری POS (source=admin) همچنان فقط در تب‌های خودش است
