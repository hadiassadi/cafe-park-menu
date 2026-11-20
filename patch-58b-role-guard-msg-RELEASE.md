# پچ ۵۸-ب — اصلاح خودترمیم قید نقش‌ها (چرا بعد از ۵۸ هنوز خطا می‌داد؟)

> تاریخ: 2026-11-20 · پایه: main (پس از ۵۸ / PR #129) · SQL خودترمیم + بهبود پیام کد

## تشخیص

پیام جزئی‌دار خطا (که خودش نشان می‌دهد کد ۵۸ فعال است) می‌گوید قید
`admin_operator_profiles_role_check` هنوز روی دیتابیس همان قید قدیمی است:

```
new row for relation "admin_operator_profiles" violates check constraint
"admin_operator_profiles_role_check"
```

یعنی SQL پچ ۵۸ (نسخهٔ اول) **اجرا نشده یا وسط راه لغو شده** — SQL Editor
سوپابیس کل اسکریپت را در یک تراکنش اجرا می‌کند و اگر هر بخشی خطا بدهد همه‌چیز
برمی‌گردد. نسخهٔ ۵۸-ب مستقل از نام قید کار می‌کند و به اجرای دوباره هم حساس نیست.

## ۱) SQL خودترمیم — `patch-58b-role-check-force.sql` (کل فایل → Run)

- کوئری «قبل»: همهٔ قیدهای check جدول + نقش‌های موجود را نشان می‌دهد
- حذف **همهٔ** قیدهای check جدول با هر نامی (`do $$ ... drop constraint %I`)
- مهاجرت هر نقش خارج از واژگان جدید (مثل `operator`) → `staff`
- ساخت قید جدید: `check (role in ('owner','manager','cashier','staff'))`
- `notify pgrst, 'reload schema'` — تا تغییر DDL فوراً برای API دیده شود
- کوئری «بعد» — **اگر باز هم خطا گرفتی، خروجی همین کوئری را برای من بفرست**

## ۲) کد (اختیاری ولی توصیه‌شده)

- اگر خطای 23514 بيايد، پیام پنل دیگر متن خام دیتابیس نیست؛ مستقیم می‌گوید:
  «قید قدیمی نقش‌ها هنوز فعال است — فایل patch-58b-role-check-force.sql را اجرا
  کن و دوباره تلاش کن» و یادآوری می‌کند کاربر auth قبلاً ساخته شده و فقط نقشش
  باید از جدول ثبت شود.

## ترتیب اجرا

```powershell
# ۱) اول SQL: Supabase → SQL Editor → کل patch-58b-role-check-force.sql → Run
#    → کوئری آخر باید: admin_operator_profiles_role_check | CHECK (role in
#       ('owner','manager','cashier','staff')) را نشان بدهد

# ۲) همین حالا (بدون دیپلوی) از پنل امتحان کن:
#    کاربران و دسترسی → تیک «نمایش همهٔ کاربران» → نقش صندوق‌دار → 💾 → «✓ ذخیره شد»

# ۳) کد ۵۸-ب:
git checkout main
git pull origin main
git checkout -b feat/patch-58b-role-guard-msg
# patch-58b-role-guard-msg.patch داخل پوشهٔ پروژه
git apply --ignore-whitespace --verbose patch-58b-role-guard-msg.patch
Remove-Item patch-58b-role-guard-msg.patch
git add -A
git commit -m "58b: actionable guard message when legacy role CHECK constraint still active"
git push -u origin feat/patch-58b-role-guard-msg
```

## بازیابی کاربر ساخته‌شدهٔ قبلی

کاربر auth او وجود دارد؛ بعد از اجرای SQL فقط: تیک «نمایش همهٔ کاربران» → نقش
«صندوق‌دار» → 💾 → ورود با همان ایمیل/رمزی که موقع ساخت گذاشته بودی.
