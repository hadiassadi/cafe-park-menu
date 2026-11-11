# پچ ۴۶ — توکن‌های تم ادمین (لایه ۱ + لایه ۲: شِل) — بدون تغییر رنگ

پیش‌نیاز: پچ ۴۵ مرج شده باشد (PR #78). بدون migration.

## این پچ چه می‌سازد؟
زیربنای شخصی‌سازی کامل پنل (رنگ/فونت/فاصله/انحنا) به‌صورت **متغیرهای CSS استاندارد**.
از این به بعد هر تغییر تم = عوض کردن چند متغیر، نه صدها hex پراکنده.

## تغییرات

### ۱) بلوک توکن‌ها روی `.admin-shell` (۲۶ توکن)
نام‌گذاری از قرارداد موجود `--admin-*` (که دارک‌مود از قبل داشت) ادامه یافت — نه سیستم موازی.
**مقدار پیش‌فرض هر توکن = دقیقاً همان رنگ فعلی → تغییر بصری صفر:**

| گروه | توکن‌ها |
|---|---|
| سطوح | `--admin-bg / -surface / -surface-2` |
| متن | `--admin-text / -text-muted` |
| برند | `--admin-primary / -primary-fg` |
| وضعیت | `--admin-danger / -danger-strong / -danger-soft / -success / -success-soft / -warning` |
| فرم | `--admin-radius / -radius-sm / -shadow` |
| فونت | `--admin-font-body / -font-heading` (فعلاً Vazirmatn) |
| فاصله | `--admin-space-1…6` (4/8/12/16/20/24px) |

### ۲) `.admin-shell.dark-mode`
۶ توکن رنگِ جدید برای حالت شبانه اضافه شد (danger-strong = `#d97a6c` مطابق دکمهٔ خروج فعلی دارک).
قوانین صریح دارک‌مود دست‌نخورده ماند → **حالت شبانه هیچ تغییری نمی‌کند**. توکن‌های غیررنگی از
`.admin-shell` به ارث می‌رسند.

### ۳) مهاجرت hex → var (۳۵ مورد، فقط سلکتورهای `.admin`)
با اسکریپت (`scripts/migrate_admin_tokens_46.py`) با سه گارد: فقط سلکتورهای ادمین،
هرگز تعریف متغیرها، هرگز داخل keyframes. hexهای باقی‌مانده در فایل متعلق به سایت مشتری‌اند
(`.card-title`، `.btn`، `.dashboard`، …) — مهاجرت‌شان طبق برنامهٔ ماژول‌به‌ماژول در پچ‌های آینده.

### ۴) فشرده‌سازی ظریف فاصله‌های شِل (تنها تغییر عمدیِ قابل دیدن)
| عنصر | قبل | بعد |
|---|---|---|
| هدر سایدبار | 20×18 | 16×16 |
| ناوبری | 12×10 | 12×8 |
| آیتم منو / خروج | 10×12 | 8×12 |
| فوتر سایدبار | 12×10 | 12×8 |
| محتوای اصلی | 24×28 | 20×24 |
| کارت (padding / فاصله) | 20 / 24 | 16 / 20 |

radius شِل هم توکن شد (کارت 16→`--admin-radius`، منو/خروج 10→`--admin-radius-sm` — هم‌ارزش).

## خارج از دامنه این پچ (تصمیم re-scope)
- **migration دیتابیس** (ستون `tokens` + فیلد `scope` روی `themes`) → پچ ۵۱، همراه ویرایشگر تم که
  مصرف‌کنندهٔ آن است — مایگریشن بی‌مصرف الان فقط ریسک است
- فونت آپلودی، پریست‌ها، توکن‌سازی سایت مشتری → پچ ۵۱

## دروازه‌ها
- verifier CSS: توازن 2278 جفت آکولاد، گارد دسکتاپ سالم، بدون var(var(…) جدید → ALL SAFE
- `tsc --noEmit` ✓ — `next build` تولیدی با mock ✓ — apply-check + تایپ پس از اعمال ✓

## اعمال (PowerShell)
```powershell
git checkout main && git pull
git checkout -b fix/patch-46-admin-design-tokens
git apply --ignore-whitespace --verbose patch-46-admin-design-tokens.patch
# صحت اعمال — انتظار دقیق:
(Select-String -Path "app\globals.css" -Pattern "--admin-radius-sm").Count   # 3  (تعریف + منو + خروج)
(Select-String -Path "app\globals.css" -Pattern "--admin-space-5").Count     # 3  (تعریف + main + کارت)
(Select-String -Path "app\globals.css" -Pattern "--admin-surface:").Count    # 2  (light + dark تعریف)
git add -A
git commit -m "refactor(admin): patch 46 - design tokens foundation + shell chrome migration"
git push -u origin fix/patch-46-admin-design-tokens
```
سپس PR و merge: `https://github.com/hadiassadi/cafe-park-menu/compare/main...fix/patch-46-admin-design-tokens`

## تست بعد از merge
1. `git checkout main` ← `git pull` ← ری‌استارت dev ← `Ctrl+F5`
2. **رنگ‌ها هیچ تغییری نکرده‌اند** (light و dark هر دو مثل قبل)
3. سایدبار/کارت‌ها کمی جمع‌وجورتر شده‌اند (فشرده‌سازی عمدی فاصله‌ها)
4. drawer موبایل و منوی تاشو مثل قبل سالم
5. اگر رنگ یا چیدمانی خراب شده: اسکرین‌شات + خروجی سه دستور Select-String بالا
