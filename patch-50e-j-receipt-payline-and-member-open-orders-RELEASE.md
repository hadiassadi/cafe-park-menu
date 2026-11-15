# پچ ۵۰-هـ-ر — دو فیکس تست: روش پرداختِ فاکتور باز + سفارش‌های بازِ عضو در پنل مشتری

> تاریخ: 2026-11-14 · پایه: main (پس از ۵۰-هـ-خ / PR #98 و ۵۰-هـ-ذ / PR #99)

## ۱) 🐛 فاکتور مشتریِ بازِ تسویه‌نشده «نحوهٔ پرداخت: نقدی» نشان می‌داد
هر سفارش POS هنگام ثبت `payment_method: 'cash'` پیش‌فرض می‌گیرد (فیلد روشِ
آخرین پرداخت، نه «پرداخت شده»). فیش مشتری/سالن وقتی هیچ پرداختِ تأییدشده‌ای
وجود نداشت، به همین فیلد برمی‌گشت و روی فاکتور باز «نقدی» چاپ می‌شد — گمراه‌کننده.

**فیکس** (`NewOrderClient.tsx`): `payLine` فقط از پرداخت‌های واقعی (`order_payments`
تأییدشده) می‌آید؛ fallback به `payment_method` فقط وقتی مجاز است که وضعیت تسویه
«پرداخت‌شده» باشد. برای فاکتورِ باز فقط خط «⏳ تسویه نشده — مانده: …» می‌آید.
همین فیکس روی «روش پرداخت» فیش سالن هم اعمال شد.

## ۲) 🐛 سفارش‌های بازِ عضوِ حضوری در «سفارش‌های باز» پنل مشتری نمی‌آمدند
دو ریشه:
- **زنجیرهٔ شناسایی شماره ناقص بود**: پچ قبلی شمارهٔ مشتری را فقط از «آخرین
  سفارشِ دستگاه» می‌گرفت. عضوِ ثبت‌شده‌ای که از این دستگاه سفارش آنلاینِ حاوی
  شماره نداشته باشد لنگر نمی‌گرفت → سفارش‌های POS‌اش (تأیید‌شده/در جریان) به
  پنلش وصل نمی‌شد. حالا سه‌مرحله‌ای است — همان منطق هویتِ خود پنل:
  1. آخرین سفارش دستگاه (لنگر قبلی)
  2. `customers.device_id_hash` — ردیف عضو وصل‌شده به همین دستگاه
  3. عضو سازمانی همان دستگاه (`organization_members.metadata._phone`)
- **دام NULL در فیلتر تستی**: `neq('is_test', true)` در SQL یعنی `is_test <> true`
  و ردیف‌هایی که ستونشان NULL است (سفارش‌های قدیمی‌تر) را هم کنار می‌گذاشت.
  به `.or('is_test.is.null,is_test.eq.false')` تغییر کرد.
- دو فیلتر `or()` متوالی در PostgREST با هم AND می‌شوند (با کد supabase-js
  هم چک شد: `searchParams.append`) — یعنی «تستی نباشد» و «دستگاه یا شمارهٔ من».

نکتهٔ سازگاری: داده از همان `/api/customer/orders` می‌آید که تب‌های «سفارش‌های
باز / تاریخچه / بدهی» همه از آن فیلتر می‌کنند — با وصل‌شدن سفارش‌های POS به
پاسخ، هر سه تب درست می‌شوند. دکمهٔ لغو فقط برای سفارش‌های pending است و سفارش
POS هرگز pending نیست.

## فایل‌ها
- `app/admin/orders/new/NewOrderClient.tsx` — فیکس payLine در فیش مشتری/سالن
- `app/api/customer/orders/route.ts` — زنجیرهٔ سه‌مرحله‌ای شماره + فیلتر null-safe

## اجرا
```powershell
git checkout main
git pull origin main
git checkout -b feat/patch-50e-j-receipt-payline-and-member-open-orders
# patch-50e-j-receipt-payline-and-member-open-orders.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-50e-j-receipt-payline-and-member-open-orders.patch
Remove-Item patch-50e-j-receipt-payline-and-member-open-orders.patch
git add -A
git commit -m "Fix 50e-j: receipt pay line only for real payments; member open POS orders in customer panel (phone chain + null-safe is_test)"
git push -u origin feat/patch-50e-j-receipt-payline-and-member-open-orders
```
PR → Merge → `git checkout main && git pull` و Deploy — SQL جدید لازم نیست.

## تست
1. سفارش حضوری جدید برای عضو، بدون پرداخت → فاکتور مشتری: خط «نحوهٔ پرداخت»
   نداشته باشد؛ فقط «⏳ تسویه نشده — مانده: X»
2. بعد از ثبت پرداخت از POS (➕ ثبت پرداخت) → چاپ دوباره → «نقدی/کارت‌خوان X»
3. همان عضو، پنل مشتری → تب «🛍️ سفارش‌های باز» → سفارش تأیید‌شده/آماده‌سازی حضوری
   دیده شود؛ «تاریخچه» و «بدهی» هم درست
4. سفارش‌های قدیمی (قبل از ستون is_test) در پنل مشتری بازگردند (فیلتر NULL حذف نشود)
