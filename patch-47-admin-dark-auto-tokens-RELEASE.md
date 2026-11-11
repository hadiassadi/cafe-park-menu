# پچ ۴۷ — دارک‌مود خودکار در همهٔ بخش‌های ادمین (تکمیل معماری توکن‌ها)

پیش‌نیاز: پچ ۴۶ مرج شده باشد (PR #79). بدون migration. فقط `app/globals.css`.

## ریشهٔ باگ گزارش‌شده (متن تیره در بخش جملات در حالت شب)
مکانیزم دارک‌مود پروژه «موردبه‌مورد» بود: قوانین صریح `.admin-shell.dark-mode .X` فقط برای
بخشی از کلاس‌ها نوشته شده بود. فهرست‌برداری کامل (اسکریپت روی همهٔ TSXهای ادمین) نشان داد
**~۱۰۱ کلاس فقط-ادمینی hex خام و بدون پوشش دارک دارند** — از جمله `.quote-card*` (همان باگ
جملات)، `.status-toggle`، `.btn/.field`، کلاس‌های cleanup/font/cancellation/category/coupon-*
و… → در حالت شب همان رنگ‌های روشن می‌مانند و متن «غیب» می‌شود.

## فیکس سیستمیک — نه وصله
تکمیل معماری پچ ۴۶: **همهٔ قوانین محتوای ادمین حالا از توکن می‌خوانند**؛ دارک‌مود = فقط override
همان چند متغیر روی `.dark-mode` → هر بخش، شناخته یا ناشناخته، خودکار سازگار می‌شود.
- **۲۰۱ جایگزینی** hex→var در قوانین ادمین (۴۸۶ کلاس فقط-ادمین + ۴۰ مشترک)
- الگوی دوگانه: کلاس فقط-ادمین → `var(--admin-x)`؛ کلاس **مشترک با سایت** →
  `var(--admin-x, #hex)` (سایت مشتری با fallback دقیقاً همان رنگ قبلی)
- **۱۰ توکن جدید** (مقادیر light = همان رنگ فعلی؛ dark = هماهنگ با پالت شب موجود):

| توکن | light | dark |
|---|---|---|
| `--admin-text-strong / -soft / -faint / -disabled` | #29251f / #625b51 / #8b8277 / #b8ad9c | #f5efe4 / #b3aa9d / #8f867a / #6f675c |
| `--admin-primary-light / -deep` | #9a6b3f / #5a4230 | #c49b72 / #d0a87e |
| `--admin-border-soft / -surface-3` | #ebe6de / #fbf9f5 | #423d33 / #302b25 |
| `--admin-success-strong / -light` | #2d5d3e / #8cc79a | #a9d8b2 / #8cc79a |

- **ادغام‌های تن مستند** (دلتای کوچک فقط در حالت روشن، برای ساده‌سازی مقیاس توکن‌ها):
  #9a9287/#aaa297→`-text-faint`، #5a5247/#6a6259→`-text-soft`، #d8d0c4/#d7cdbf/#eee9e4/#efe9e0→`-border-soft`،
  #822f26→`-danger-strong`، #f2c9c5→`-danger-soft`، #c8dfcb/#d5e8d8→`-success-soft`، #faf7f2→`-surface-3`
- **خروج‌های عمدی**: بلاک‌های `@media print` و کلاس‌های `print-invoice*` (فاکتور باید روی کاغذ سفید
  بماند)، پیش‌نمایش تم‌ها (theme-/preset-)، `#fff`، `#d97a6c` (تن شب)، `#7a3a7a` (رنگ تأکیدی)،
  و قوانین صفحات خطا/۴۰۴ (`status-card` بیرون شِل ادمین است — مثل قبل روشن)

## دروازه‌ها
- verifier CSS: توازن آکولاد، گارد دسکتاپ، بدون var تودرتوی جدید → ALL SAFE
- `tsc --noEmit` ✓ — `next build` تولیدی با mock ✓ — apply-check + تایپ پس از اعمال ✓
- idempotent: اجرای دوباره اسکریپت، صفر تغییر اضافه

## اعمال (PowerShell)
```powershell
git checkout main && git pull
git checkout -b fix/patch-47-admin-dark-auto-tokens
git apply --ignore-whitespace --verbose patch-47-admin-dark-auto-tokens.patch
# صحت اعمال — انتظار دقیق:
(Select-String -Path "app\globals.css" -Pattern "var\(--admin-").Count             # > 800
(Select-String -Path "app\globals.css" -Pattern "--admin-text-strong:").Count      # 2 (light + dark)
(Select-String -Path "app\globals.css" -Pattern "background: var\(--admin-surface\)").Count | Out-Null
# چشمی: بلاک .quote-card باید var(--admin-surface) داشته باشد
Select-String -Path "app\globals.css" -Pattern "\.quote-card \{" -Context 0,8
git add -A
git commit -m "fix(admin): patch 47 - dark mode auto-applies everywhere via completed token migration"
git push -u origin fix/patch-47-admin-dark-auto-tokens
```
سپس PR و merge: `https://github.com/hadiassadi/cafe-park-menu/compare/main...fix/patch-47-admin-dark-auto-tokens`

## تست بعد از merge (کاربر)
1. `git checkout main` ← `git pull` ← ری‌استارت dev ← `Ctrl+F5`
2. **جملات در حالت شب**: کارت‌ها و متن‌ها باید کاملاً خوانا باشند
3. مرور حالت شب در همهٔ بخش‌ها: سفارش‌ها، کوپن‌ها، مشتریان، تم‌ها، داشبورد، پشتیبان‌گیری، تنظیمات — هیچ متن تیره‌ای نباید غیب شود
4. حالت روشن: بدون تغییر محسوس (به‌جز ادغام‌های تن مستند بالا)
5. منوی عمومی + صفحات خطا/۴۰۴: دست‌نخورده · فاکتور چاپی: همچنان روی سفید

## پیوند با خواستهٔ «دارک هوشمند» (پچ ۵۱)
حالا که کل پنل توکن‌محور است، «انتخاب یک رنگ پایه → تولید خودکار حالت شب» فقط یعنی پر کردن
همین ~۳۰ متغیر با فرمول روشنایی/هیو — در معماری پچ ۵۱ ثبت شد.
