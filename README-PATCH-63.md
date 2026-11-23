# پچ ۶۳ — ادغام دسترسی‌ها در «کاربران و دسترسی» + آزاد شدن تیک‌ها

> تاریخ: 2026-11-23 · خواسته‌ها: (۱) مدیریت دسترسی ماژول‌ها در خود صفحهٔ
> «کاربران و دسترسی» بیاید و منوی جداگانه حذف شود؛ (۲) تیک‌های مالک قابل
> ویرایش شوند و تیک «داشبورد» هم مثل بقیه انتخاب‌شدنی باشد.

## تغییرات رفتاری

- بخش «🧩 سطح دسترسی ماژول‌ها» پایین صفحهٔ «کاربران و دسترسی» می‌آید؛
  آیتم «دسترسی ماژول‌ها» از منو حذف و `/admin/access` به `/admin/users`
  redirect می‌شود (لینک‌های قدیمی نمی‌شکنند).
- مجوزِ مدیریت تیک‌ها = تیکِ «کاربران و دسترسی» (API هم به همین گیت تغییر کرد).
  تغییرِ نقش همچنان فقط با مالک.
- تیک «داشبورد» دیگر قفل نیست و اگر برداشته شود کاربر واقعاً داشبورد را
  ندارد → به‌جای حلقهٔ ریدایرکت، به صفحهٔ ورود می‌رود (`?denied=2`).
- تیک‌های مالک قابل ذخیره‌اند: **مالک با لیست ذخیره‌شده محدود می‌شود؛ مالک با
  لیست خالی = همه‌چیز.** چیپ ردیف مالک این را توضیح می‌دهد.
- حفاظت خودقفل‌شدگی: ذخیرهٔ ردیفِ «خودت» وقتی تیکِ «کاربران و دسترسی» را
  برداشته باشی، یک `confirm` هشدار می‌خواهد.
- مسیر `/admin/access` از رجیستری حذف شده؛ اگر در لیست‌های ذخیره‌شدهٔ قدیمی
  بود، خودکار پاک می‌شود — **نیازی به SQL نیست.**

## فایل‌های zip (جایگزین کامل)

| فایل | تغییر |
| --- | --- |
| `lib/version.ts` | مُهر نسخه → `63` |
| `lib/admin/modules.ts` | حذف `/admin/access` از رجیستری + داشبورد اجباری نیست + گیت واحد |
| `lib/admin/roles.ts` | داشبوردِ بدون تیک → ورود (`denied=2`) |
| `proxy.ts` | همین ریدایرکت امن در دروازهٔ صفحات |
| `app/api/admin/access/route.ts` | گیت GET/POST → `/admin/users` |
| `app/admin/access/page.tsx` | فقط redirect به `/admin/users` |
| `app/admin/access/AccessManager.tsx` | تیک‌ها آزاد + هشدار خودقفل‌شدگی + متن‌ها |
| `app/admin/users/page.tsx` | رندر AccessManager زیر جدول کاربران |

## دو ویرایش دستی در `app/admin/layout.tsx` (مهم!)

**۱) حذف آیتم منو** — این خط را پیدا و کامل پاک کن:

```tsx
      { href: '/admin/access', label: 'دسترسی ماژول‌ها', icon: '🧩' },
```

**۲) جایگزینی کامل تابع menuAllows** — بلوک فعلی (نسخهٔ پچ ۶۲):

```tsx
  const menuAllows = (href: string) => {
    if (!whoamiReady) return false
    if (href === '/admin' || href === '/admin/login') return true
    if (allowedPaths && allowedPaths.length > 0) {
      // 🎯 پچ ۶۰-و: تیک داشبورد ('/admin') فقط خود داشبورد — نه پیشوندِ کل /admin/*
      return allowedPaths.some(
        (p) => p !== '/admin' && (href === p || href.startsWith(p + '/'))
      )
    }
    if (!role) return false
    return roleAllowsPath(role, href)
  }
```

جایگزین با:

```tsx
  const menuAllows = (href: string) => {
    if (!whoamiReady) return false
    if (href === '/admin/login') return true
    if (allowedPaths && allowedPaths.length > 0) {
      // 🎯 پچ ۶۳: داشبورد هم مشمول تیک‌ها؛ '/admin' فقط خود داشبورد را باز می‌کند
      return allowedPaths.some(
        (p) => href === p || (p !== '/admin' && href.startsWith(p + '/'))
      )
    }
    if (!role) return false
    return roleAllowsPath(role, href)
  }
```

## نصب و دیپلوی

```powershell
# ویرایش‌های layout.tsx بالا را انجام بده، بعد:
git add -A
git commit -m "patch 63: merge access management into users page + editable ticks (incl. dashboard & owner)"
git push origin main
```

## راستی‌آزمایی (پنجرهٔ ناشناس)

1. `/api/admin/whoami` → `"build":"63"`
2. اکانت مالک → منو دیگر «دسترسی ماژول‌ها» ندارد؛ در «کاربران و دسترسی» بخش
   «🧩 سطح دسترسی ماژول‌ها» پایین جدول است؛ تیک داشبورد و ردیف مالک آزادند.
3. c2 → همان منوهای قبلی + بدون دسترسی به `/admin/users` (نیست در تیک‌هایش).
4. تیک داشبورد c2 را بردار و ذخیره کن → ورود دوباره با c2 → مستقیم به
   `/admin` → صفحهٔ ورود؛ منو بدون داشبورد. بعد تیک را برگردان.
5. تیک‌های مالک خودت را کم کن و ذخیره → منویت محدود می‌شود؛ برگرداندن با
   «بازگشت به پیش‌فرض نقش» یا لیست خالی ذخیره.

## راه نجات (اگر ادمین خودش را قفل کرد)

در Supabase SQL Editor:

```sql
update admin_operator_profiles set allowed_paths = null;
-- یا فقط یک کاربر:
-- update admin_operator_profiles set allowed_paths = null
--   where user_id = '<USER_ID>';
```

لیست خالی = «پیش‌فرض نقش» → مالک دوباره همه‌چیز دارد.
