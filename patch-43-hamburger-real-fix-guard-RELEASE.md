# پچ ۴۳ — اعمال واقعی فیکس همبرگر + منوی تاشو + قانون محافظ دسکتاپ

## ⚠️ ریشه‌یابی: چرا پچ ۴۲ «اثر نکرد»؟
بررسی کامیت مرج‌شده PR #75 نشان داد فقط **سه فایل متنی** داخل ریپو commit شده‌اند:
`patch-42-hamburger-fix-collapsible-nav.patch`، فایل RELEASE و `admin-redesign-plan.md`.
یعنی فایل پچ داخل ریپو ذخیره شده ولی **دستور `git apply` روی کد اجرا نشده** — تغییرات
`app/admin/layout.tsx` و `app/globals.css` هرگز اعمال نشدند (grep برای مارکرهای پچ ۴۲ در
main صفر بود). اسکرین‌شات هم دقیقاً رفتار پچ ۴۱ را نشان می‌داد.

## محتوای پچ ۴۳
1. **همان تغییرات کد پچ ۴۲** — این بار واقعاً روی کد:
   - رفع wrapper جاافتاده: قوانین هدر موبایل حالا داخل `@media (max-width: 768px)` درست هستند
   - گروه‌های تاشوی منو (دکمه + ▾ + ذخیره در localStorage + باز شدن خودکار گروهِ مسیر فعال) در سایدبار و drawer
2. **قانون محافظ دسکتاپ (جدید)**: در انتهای globals.css:
   `@media (min-width: 769px) { .admin-mobile-header, .admin-drawer-overlay, .admin-drawer { display: none; } }`
   — این بلوک آخرین قانون فایل است؛ حتی اگر در mergeهای آینده wrapperها گم شوند، همبرگر در دسکتاپ دیده نمی‌شود.
3. **پاک‌سازی**: دو فایل منسوخ `patch-42-*.patch` و `patch-42-*-RELEASE.md` از ریشه ریپو حذف
   می‌شوند (نسخه رسمی هر دو در پوشه download موجود است). `admin-redesign-plan.md` می‌ماند.

## راستی‌آزمایی خودکار
- اسکریپت بررسی CSS: همه قوانین هدر موبایل/دِروِر یا display:none هستند یا داخل media موبایل
  یا زیر والدِ مخفی → `ALL SAFE` + توازن آکولاد ۲۲۶۶/۲۲۶۶
- `tsc --noEmit` کل پروژه: پاس — `next build` تولیدی: پاس

## اعمال — ترتیب دقیقاً مهم است ⚠️
```powershell
git checkout main && git pull
git checkout -b fix/patch-43-hamburger-real-fix-guard
# ۱) اول پچ را روی کد اعمال کن:
git apply --ignore-whitespace patch-43-hamburger-real-fix-guard.patch
# ۲) صحت اعمال را ببین (هر دو باید عدد بدهند، نه 0):
grep -c "NAV_GROUPS_KEY" app/admin/layout.tsx
grep -c "min-width: 769px" app/globals.css
# ۳) حالا commit:
git add -A
git commit -m "fix(ui): actually apply hamburger media-query fix + collapsible nav + desktop guard (patch 43)"
git push -u origin fix/patch-43-hamburger-real-fix-guard
```
خطای رایج قبلی: اگر فایل `.patch` را فقط `git add` کنی، «فایل پچ» commit می‌شود نه تغییراتش.
`git apply` باید قبل از `git add -A` اجرا شده باشد.

## تست
1. F5 روی داشبورد در دسکتاپ → **هیچ همبرگری نباید دیده شود**؛ سایدبار گروهی سر جایش
2. کلیک روی برچسب گروه‌ها → باز/بسته با ▾؛ بعد از رفرش همان وضعیت بماند
3. عرض پنجره زیر ۷۶۸ → هدر موبایل بیاید؛ بالای ۷۶۸ → غیب شود
4. منو را در حالت‌های مختلف جمع کن و بین صفحات برو → گروهِ صفحه فعال خودش باز می‌شود
