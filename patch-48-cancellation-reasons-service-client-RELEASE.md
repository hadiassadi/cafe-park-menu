# پچ ۴۸ — فیکس بخش دلایل لغو سفارش: خواندن و نوشتن از کلاینت سرویس

پیش‌نیاز: پچ ۴۷ مرج شده باشد (PR #80). بدون migration. فقط ۲ فایل.

## ریشهٔ باگ (همان بیماری پچ ۴۵ — یک جدول از فهرست جا مانده بود)
جدول `cancellation_reasons` هم RLS فعال و بدون policy دارد → deny-all مطلق:
- `app/admin/cancellation-reasons/page.tsx` با `supabaseServer()` می‌خواند → لیست خالی
- هر ۴ اکشن نوشتن (add/update/delete/toggle) با `supabaseServer()` → خطای
  «new row violates row-level security policy»
- دو مصرف‌کنندهٔ سالم (دست‌نخورده): `app/api/cancellation-reasons/route.ts` (از قبل سرویس‌کلاینت)
  و `lib/stats.ts` (کلید سرویس) — یعنی لیست دلایل در دیالوگ لغو سفارش‌ها و آمار، سالم‌اند

## فیکس — عیناً الگوی پچ ۴۵
- `page.tsx`: `supabaseServer()` → `supabaseAdmin()`
- `actions.ts`: import + هر ۴ اکشن → `supabaseAdmin()`
- گارد امنیتی `assertAdmin()` در همهٔ اکشن‌ها سر جایش (الگوی امنیتی تغییر نمی‌کند)

## دروازه‌ها
- `tsc --noEmit` ✓ — `next build` تولیدی با mock ✓ — apply-check + تایپ پس از اعمال ✓

## اعمال (PowerShell)
```powershell
git checkout main && git pull
git checkout -b fix/patch-48-cancellation-reasons-service-client
git apply --ignore-whitespace --verbose patch-48-cancellation-reasons-service-client.patch
# صحت اعمال — انتظار دقیق:
(Select-String -Path "app\admin\cancellation-reasons\actions.ts" -Pattern "supabaseAdmin").Count   # 5 (import + ۴ اکشن)
(Select-String -Path "app\admin\cancellation-reasons\actions.ts" -Pattern "supabaseServer").Count  # 0
(Select-String -Path "app\admin\cancellation-reasons\page.tsx" -Pattern "supabaseAdmin").Count     # 2
git add -A
git commit -m "fix(admin): patch 48 - cancellation reasons CRUD via service client (RLS deny-all proof)"
git push -u origin fix/patch-48-cancellation-reasons-service-client
```
سپس PR و merge: `https://github.com/hadiassadi/cafe-park-menu/compare/main...fix/patch-48-cancellation-reasons-service-client`

## تست بعد از merge (کاربر)
1. `git checkout main` ← `git pull` ← ری‌استارت dev ← `Ctrl+F5`
2. بخش «دلایل لغو سفارش»: لیست دلایل قبلی باید نمایش داده شود
3. افزودن دلیل جدید → بدون خطا + ظاهر شدن در لیست
4. ویرایش/حذف/فعال‌غیرفعال کردن → هر سه سالم
5. دیالوگ لغو سفارش در صفحهٔ سفارش‌ها → لیست دلایل پر است (از قبل سالم بود — رگرسیون ندارد)
