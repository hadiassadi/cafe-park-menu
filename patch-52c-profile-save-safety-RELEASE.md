# پچ ۵۲-ج — اصلاح ریسک پاک‌شدن تصادفی پروفایل اپراتور

> تاریخ: 2026-11-19 · پایه: main (پس از ۵۲-ب / PR #119) · بدون SQL — فقط کد

## چه چیزی اصلاح شد
در پچ ۵۲-ب، ذخیرهٔ فرم اپراتور با **همهٔ فیلدهای خالی** (نام، کد، ساعات) و نقش پیش‌فرض،
پروفایل را کامل حذف می‌کرد (طراحی «برداشتن پروفایل»). همین باعث شد با یک ذخیرهٔ خالی،
کد ۱ و نام نمایشی صاحب پاک شود.

**حالا**: ذخیرهٔ خالی فقط پروفایل را به پیش‌فرض برمی‌گرداند (بدون نام/کد/ساعت، نقش اپراتور) —
هیچ‌وقت چیزی پاک نمی‌شود. رفتار نمایشی همان است: بدون نام → ایمیل، بدون ساعت → بدون محدودیت.

## بعد از Deploy — دو قدم در پنل
۱. **شیفت‌ها → اپراتورها**: برای خودت بنویس:
   - نام نمایشی: `هادی اسدی` (یا هر اسمی که می‌خواهی در گزارش‌ها بیاید)
   - کد: `۱`
   - نقش: **👑 صاحب**
   - 💾 ذخیره → از این لحظه شیفتت هنگام بستن خودکار تایید می‌شود
     («👑 شیفت صاحب — بدون نیاز به تایید ✓»)
۲. اگر هنگام ذخیره نقش، چیزی ذخیره نشد → یعنی SQL پچ ۵۲-ب هنوز اجرا نشده. تست سریع در
   Supabase SQL Editor:
   ```sql
   select role from admin_operator_profiles limit 5;
   ```
   خطای «column role does not exist» گرفتی → اول `patch-52b-role-owner.sql` را اجرا کن.

نکته: شیفت‌های بستهٔ قبلی که هنوز «🟡 در انتظار تایید» مانده‌ند، دستورالعمل قبلی‌اند —
یا با یک اکانت دیگر تاییدشان کن یا همان‌طور در تاریخچه بمانند؛ شیفت‌های جدیدِ صاحب
خودکار تایید می‌شوند.

## اجرا
```powershell
git checkout main
git pull origin main
git checkout -b feat/patch-52c-profile-save-safety
# patch-52c-profile-save-safety.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-52c-profile-save-safety.patch
Remove-Item patch-52c-profile-save-safety.patch
git add -A
git commit -m "52c: empty operator-profile save no longer deletes the profile (accidental wipe fix)"
git push -u origin feat/patch-52c-profile-save-safety
```
PR → Merge → `git checkout main && git pull` و Deploy
