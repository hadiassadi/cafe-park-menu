# پچ ۵۰-هـ-ص — نهایی‌سازی واقعی سفارش: ورود به جریان کافه + بنر «ارسال شد»

> تاریخ: 2026-11-19 · پایه: main (پس از ۵۰-هـ-ش / PR #112) · بدون مایگریشن SQL

## اشکال گزارش‌شده
پیام سبز «سفارش نهایی شد و برای کافه ارسال شد» ظاهر می‌شد اما:
۱) سفارش واقعاً برای مدیر «نمی‌رسید» — چون نهایی‌سازی فقط پرچم
`customer_confirmed` را می‌گذاشت؛ ادمین `customer_confirmed` را نمی‌بیند و
سفارش در وضعیت «در انتظار» (pending) می‌ماند. الگوی درست داخل خود اپ هست:
وقتی ادمین پرداخت را تأیید می‌کند، سفارش pending خودکار به confirmed می‌رود
(`autoConfirmed` در actions.ts).
۲) صفحهٔ چک‌اوت مشتری در همان حالت پرداخت می‌ماند — چون payment_status همچنان
unpaid است و شرط نمایش بخش پرداخت برقرار می‌ماند.

## تغییرات

### 1) `app/api/orders/finalize-split/route.ts` — نهایی‌سازی واقعی
- در هر دو حالت نهایی (تسویهٔ کامل یا پوشش مانده با اعلام «پرداخت در محل»):
  - `customer_confirmed = true`
  - اگر سفارش `pending` بود → `status = 'confirmed'` + `confirmed_at`
    (مثل autoConfirmed ادمین — سفارش وارد لیست فعال POS و پنل مدیر می‌شود)
- پوش «✅ سفارش تأیید شد» برای مشتری (sendPushToOrder — best-effort، فقط وقتی
  واقعاً تغییری ثبت شده باشد؛ تکرار کلیک پوش تکراری نمی‌فرستد).
- پارس «اعلام نقدی» به lib مشترک منتقل شد (`lib/orders/cash-pledge.ts`).

### 2) `GET /api/orders/[id]` — `cash_pledge_total`
- جمع اعلام‌های «پرداخت در محل» از payment_note در پاسخ سفارش مشتری برمی‌گردد
  تا صفحه بتواند حالت نهایی‌شده را تشخیص دهد.

### 3) `app/order/[id]/page.tsx` — خروج از حلقهٔ چک‌اوت
- پرچم `splitFinalizedInPlace`: تأیید مشتری + اعلام نقدی ≥ مانده + سفارش فعال
- وقتی برقرار است، بخش پرداخت به بنر سبز تبدیل می‌شود:
  «✅ سفارش نهایی شد و برای کافه ارسال شد — مبلغ X هنگام تحویل/مراجعه پرداخت
  می‌شود» + دکمهٔ اختیاری «💳 می‌خوام همین حالا پرداخت کنم» که بخش پرداخت را
  دوباره باز می‌کند.
- وضعیت سفارش در نوار مراحل (STATUS_STEPS) به «تأیید شد» می‌رسد.

## اجرا
```powershell
git checkout main
git pull origin main
git checkout -b feat/patch-50e-sad-finalize-advance-confirm
# patch-50e-sad-finalize-advance-confirm.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-50e-sad-finalize-advance-confirm.patch
Remove-Item patch-50e-sad-finalize-advance-confirm.patch
git add -A
git commit -m "50e-sad: finalize-split actually advances pending->confirmed (+push), order GET exposes cash_pledge_total, customer checkout shows sent-banner instead of payment loop"
git push -u origin feat/patch-50e-sad-finalize-advance-confirm
```
PR → Merge → `git checkout main && git pull` و Deploy

## تست
1. عضو: ترکیبی → «کل مبلغ» نقدی در محل → «ثبت و پرداخت ترکیبی» → پیام سبز +
   صفحه از حلقهٔ پرداخت خارج می‌شود (بنر سبز «ارسال شد» + نوار وضعیت «تأیید شد»)
2. پنل POS/مدیر: سفارش در لیست فعال با وضعیت «تأیید/confirmed» دیده می‌شود
3. مشتری پوش «✅ سفارش تأیید شد» می‌گیرد (اگر VAPID تنظیم شده باشد)
4. «می‌خوام همین حالا پرداخت کنم» → بخش پرداخت دوباره باز می‌شود
5. سناریوی درگاه + نقدی: بازگشت از درگاه → «ارسال به کافه» → همان نتیجهٔ بنر سبز
