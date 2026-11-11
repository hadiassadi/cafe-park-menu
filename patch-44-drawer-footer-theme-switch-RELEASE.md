# پچ ۴۴ — فوتر مرتب drawer + سوییچ فشرده روز/شب

پیش‌نیاز: پچ ۴۳ مرج شده باشد (PR #76). بدون migration.

## ریشه‌یابی مشکل فوتر موبایل (اسکرین‌شات 380.PNG)
- `.admin-drawer-footer` یک **flex-row** بود ولی هر سه فرزند (مشاهده منو / دکمه تم / خروج)
  `width: 100%` داشتند → سه آیتم عریض در یک ردیف → **سرریز افقی و بریده‌شدن «خروج»**
- دکمه تم متنیِ «حالت شبانه» در عرض کم **دوخطی** می‌شد (متن زیر آیکن می‌شکست)

## تغییرات
1. **سوییچ روز/شب آیکنی** (`AdminThemeToggle.tsx` بازنویسی شد):
   - پیل سوییچ ۵۶×۲۸ با خورشید ☀️ و ماه 🌙 در دو سر + دسته لغزنده — **بدون متن**
   - `role="switch"` + `aria-checked` (دسترس‌پذیری استاندارد) + tooltip
   - همان کامپوننت در فوتر سایدبار دسکتاپ هم سوییچ شد — یکدست
   - ذخیره در localStorage و رفتار dark-mode دقیقاً مثل قبل
2. **فوتر drawer شبکه‌ای**: `grid-template-columns: 1fr auto 1fr` — مشاهده منو | سوییچ | خروج،
   هر آیتم `white-space: nowrap` و `min-width: 0` → دیگر هیچ سرریز و شکست خطی وجود ندارد
3. **محافظ اسکرول**: `overflow-x: hidden` روی `.admin-drawer`
4. CSS قدیمی `width:100%` فوتر با مقادیر فشرده و وسط‌چین جایگزین شد

## دروازه‌ها
- verifier CSS (همبرگر/دِروِر): ALL SAFE — توازن آکولاد ✓
- esbuild syntax + `tsc --noEmit` کل پروژه: پاس — `next build` تولیدی: پاس
- apply-check + تایپ بعد از اعمال: پاس

## اعمال (PowerShell — ترتیب مهم است)
```powershell
git checkout main && git pull
git checkout -b fix/patch-44-drawer-footer-theme-switch
git apply --ignore-whitespace patch-44-drawer-footer-theme-switch.patch
# صحت اعمال — هر دو باید عدد بدهند (نه 0):
(Select-String -Path "app\admin\components\AdminThemeToggle.tsx" -Pattern "admin-theme-switch").Count
(Select-String -Path "app\globals.css" -Pattern "admin-drawer-footer-cell").Count
git add -A
git commit -m "fix(admin): tidy drawer footer grid + icon-only day/night switch (patch 44)"
git push -u origin fix/patch-44-drawer-footer-theme-switch
```
سپس مثل همیشه Pull Request بسازید و مرج کنید:
`https://github.com/hadiassadi/cafe-park-menu/compare/main...fix/patch-44-drawer-footer-theme-switch`

## تست
1. موبایل: drawer را باز کن — فوتر سه‌ستونی مرتب: 🌐 مشاهده منو | سوییچ | 🚪 خروج — بدون اسکرول افقی، بدون متن دوخطی
2. سوییچ را بزن → تم تاریک/روشن عوض شود؛ رفرش → حالت بماند؛ ▸ دسته از لبه بیرون نزند
3. دسکتاپ: سوییچ وسط فوتر سایدبار وسط‌چین و مرتب
4. میان‌بر: RTL — ماه سمت چپ پیل و خورشید سمت راست باشد (درست بودن جهت‌ها)
