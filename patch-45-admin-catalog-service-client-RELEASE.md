# پچ ۴۵ — فیکس قطعی بخش‌های خالی ادمین: خواندن کاتالوگ از کلاینت سرویس

پیش‌نیاز: پچ ۴۴ مرج شده باشد (PR #77). بدون migration.

## ریشه‌یابی قطعی (با تست‌های REST کاربر)
- **علامت**: ۵ بخش ادمین (محصولات، دسته‌ها، میزها، تم‌ها، جملات) خالی و «خام» بدون پیام خطا؛
  منوی عمومی و سفارش‌ها سالم
- **تست ۱**: با کلید عمومی → همهٔ ۵ جدول «200 ولی صفر ردیف» (مسدودسازی بی‌صدا) و orders → 401
- **تست ۲**: با کلید سرویس و User-Agent سفارشی → محصولات ۸، دسته‌ها ۶، میزها ۶، تم‌ها ۲، جملات ۳۱،
  سفارش‌ها ۱۱۹ → **داده‌ها کاملاً سالم‌اند**
- **SQL Editor**: `pg_policies` روی این ۵ جدول → «No rows returned» یعنی **RLS فعال شده ولی هیچ
  policy تعریف نشده → deny-all مطلق** (PostgREST بی‌صدا صفر ردیف برمی‌گرداند)
- نکته: خطای 401 اولیه در تست پاورشل (Forbidden use of secret API key in browser) فقط به‌دلیل
  User-Agent شبیه مرورگر در Invoke-WebRequest بود — کلید کاملاً سالم است
- **مسیرها**: منوی عمومی (`lib/menu.ts`) و صفحهٔ سفارش‌ها از قبل با کلاینت سرویس می‌خواندند → سالم؛
  ۵ بخش خراب از `supabaseServer()` (کلید عمومی + RLS) می‌خواندند → خالی

## تغییرات (۶ فایل)
1. `app/admin/products/page.tsx` → `supabaseAdmin()`
2. `app/admin/categories/page.tsx` → `supabaseAdmin()`
3. `app/admin/tables/page.tsx` → `supabaseAdmin()`
4. `app/admin/themes/page.tsx` → `supabaseAdmin()`
5. `app/api/quotes/route.ts` → `supabaseAdmin()` + حذف چک `db.auth.getUser()` در POST
   (کلاینت سرویس نشست کاربر ندارد؛ مجوز با `requireAdmin()` که سر جایش است تضمین می‌شود)
6. `app/api/quotes/[id]/route.ts` → همین الگو در PATCH و DELETE

امنیت: همهٔ مسیرها همچنان پشت `requireAdmin()`/`assertAdmin()` هستند؛ فقط منبع داده (کلید) عوض شده و
دقیقاً به الگوی موجود پروژه (سفارش‌ها، منو، کوپن‌ها) یکدست می‌شود.

## دروازه‌ها
- وریفای شمارش: supabaseAdmin = 2/2/2/2/3/3 و supabaseServer = 0 در هر ۶ فایل ✓
- `tsc --noEmit` کل پروژه: پاس — `next build` تولیدی با mock: پاس
- apply-check + تایپ بعد از اعمال (roundtrip): پاس

## اعمال (PowerShell)
```powershell
git checkout main && git pull
git checkout -b fix/patch-45-admin-catalog-service-client
git apply --ignore-whitespace --verbose patch-45-admin-catalog-service-client.patch
# صحت اعمال — انتظار دقیق:
(Select-String -Path "app\admin\products\page.tsx" -Pattern "supabaseAdmin").Count      # 2
(Select-String -Path "app\admin\categories\page.tsx" -Pattern "supabaseAdmin").Count    # 2
(Select-String -Path "app\admin\tables\page.tsx" -Pattern "supabaseAdmin").Count        # 2
(Select-String -Path "app\admin\themes\page.tsx" -Pattern "supabaseAdmin").Count        # 2
(Select-String -Path "app\api\quotes\route.ts" -Pattern "supabaseAdmin").Count          # 3
(Select-String -Path "app\api\quotes\[id]\route.ts" -Pattern "supabaseAdmin").Count     # 3
git add -A
git commit -m "fix(admin): patch 45 - catalog admin sections read via service client (RLS deny-all proof)"
git push -u origin fix/patch-45-admin-catalog-service-client
```
سپس PR و merge: `https://github.com/hadiassadi/cafe-park-menu/compare/main...fix/patch-45-admin-catalog-service-client`

## تست بعد از merge
1. `git checkout main` ← `git pull` ← ری‌استارت کامل سرور dev
2. پنج بخش محصولات/دسته‌ها/میزها/تم‌ها/جملات باید داده نشان بدهند (۸ محصول، ۶ دسته، …)
3. منوی عمومی + سفارش‌ها + مشتریان: سالم بمانند
4. افزودن/ویرایش/حذف جمله در بخش جملات کار کند (POST/PATCH/DELETE با مسیر جدید)
