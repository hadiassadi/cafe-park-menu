# پچ ۳۸ — پرداخت ترکیبی: بخشی از کیف پول + باقی‌مانده از درگاه

## تغییرات
- **Migration** (`20261111_wallet_partial_pay.sql`):
  - `pay_order_with_wallet(p_order_id, p_device_hash, p_amount default null)` — پارامتر اختیاری مبلغ:
    - `p_amount = null` → رفتار قبلی: کل باقی‌مانده پرداخت و سفارش تأیید می‌شود (بدون تغییر)
    - `p_amount = N` → فقط N تومان از کیف پول برداشت و به‌عنوان ردیف `confirmed` در `order_payments` ثبت می‌شود؛ سفارش باز می‌ماند (`payment_status = partial`) تا باقی‌مانده با درگاه تسویه شود
    - `N > باقی‌مانده` → خطای `amount_exceeds_remaining` (برداشت اضافه ممنوع)
  - خروجی جدید: `remaining` (باقی‌مانده بعد از پرداخت)
- **`/api/payment/wallet` POST**: پذیرش `amount` اختیاری (integer مثبت) و پاس‌دادن به RPC + برگرداندن `remaining`
- **Checkout** (`app/checkout/page.tsx`):
  - وقتی موجودی کیف پول < مبلغ نهایی **و** درگاه آنلاین فعال است، گزینه کیف پول دیگر غیرفعال نمی‌شود؛ حالت «ترکیبی» می‌شود با راهنما: «ترکیبی: X از کیف پول + Y از درگاه»
  - در submit: اول بخش موجودی از کیف پول (`amount = موجودی`)، بعد درگاه **بدون amount** (کل باقی‌مانده واقعی سمت سرور — مصون از اختلاف احتمالی محاسبه کلاینت/سرور)
  - اگر کیف پول ناموفق بود → کل مبلغ از درگاه؛ اگر درگاه بعد از پرداخت کیف پولی ناموفق بود → هدایت به صفحه سفارش برای پرداخت باقی‌مانده
  - `payment_method` سفارش در حالت ترکیبی = `online` (روش پایانی)
- **صفحه سفارش** (`app/order/[id]/page.tsx`): وضعیت `partial` پشتیبانی شد — برچسب «پرداخت جزئی»، badge «🧩 پرداخت جزئی»، دکمه «💳 پرداخت باقی‌مانده از درگاه» (سرور خودش باقی‌مانده را حساب می‌کند) و متن بخش بدهی
- دیتابیس فقط function عوض می‌شود؛ اسکیمای جدیدی ندارد و backward-compatible است.

## اعمال
1. **اول** migration را در Supabase SQL Editor اجرا کن: `supabase/migrations/20261111_wallet_partial_pay.sql`
2. سپس:
```powershell
git checkout main && git pull
git checkout -b fix/patch-38-mixed-payment
git apply --ignore-whitespace patch-38-mixed-payment.patch
npx tsc --noEmit
git add -A
git commit -m "feat(payment): mixed wallet+gateway payment — partial wallet spend, checkout split flow, partial status UI (patch 38)"
git push -u origin fix/patch-38-mixed-payment
```
3. Pull Request به main

## تست
- کیف پول با موجودی کمتر از مبلغ سفارش + درگاه روشن: گزینه کیف پول «ترکیبی: X از کیف پول + Y از درگاه» و قابل انتخاب باشد
- ثبت سفارش ترکیبی: بخش کیف پول کسر شود، ریدایرکت به درگاه برای باقی‌مانده؛ بعد از پرداخت، وضعیت سفارش «پرداخت شده» و دو ردیف در `order_payments`
- انصراف در درگاه: سفارش با وضعیت «پرداخت جزئی» بماند؛ صفحه سفارش badge جزئی + دکمه «پرداخت باقی‌مانده از درگاه» را نشان دهد
- کیف پول با موجودی کافی: رفتار قبلی (پرداخت کامل + تأیید سفارش) دست‌نخورده
- درگاه خاموش + موجودی ناکافی: گزینه کیف پول غیرفعال با «موجودی کافی نیست» (مثل قبل)
