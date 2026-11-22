# پچ ۶۰ — دسترسی ماژولار منو (تیکِ هر بخش برای هر کاربر)

> تاریخ: 2026-11-22 · بدون git apply — فایل‌های جدید + جایگزینی ۳ فایل + ۴ ویرایش کوچک layout + SQL کوچک

## چه می‌سازد؟

- صفحهٔ جدید **«دسترسی ماژول‌ها»** (`/admin/access`، آیتم منوی 🧩): مدیر هر کاربر
  پنل را باز می‌کند و تیک می‌زند کدام بخش‌ها برایش باشد — همهٔ ۲۷ ماژولِ پنل
  دسته‌بندی‌شده (عملیات روزانه / کاتالوگ / باشگاه / کیف پول / گزارش‌ها / سیستم)
- **منو فوراً فیلتر می‌شود**: کاربر فقط بخش‌های تیک‌شده را در سایدبار و drawer می‌بیند
- **گیت سرور واقعی**: اگر کاربر بخشِ تیک‌نخورده را با آدرس مستقیم باز کند، پروکسی
  او را به داشبورد برمی‌گرداند؛ actionها و APIها هم با همان لیست گارد می‌شوند
- **دو حالت برای هر کاربر**: «پیش‌فرض نقش» (ماتریس پچ ۵۶ — رفتار فعلی) یا «دلخواه»
  (فقط تیک‌شده‌ها). با «بازگشت به پیش‌فرض نقش» هر وقت خواستی برمی‌گردد
- داشبورد همیشه برای همهٔ کاربران پنل باز است؛ دسترسی مالک سلب‌ناپذیر است
- اگر ماتریس نقش چیزی را اجازه می‌دهد ولی مدیر تیکش را بردارد → بسته می‌شود؛
  و اگر نقش اجازه نمی‌دهد، تیک‌زدن در صفحهٔ دسترسی‌ها می‌تواند بازش کند (اختیاریِ کامل با مدیر)

## ترتیب اجرا

### ۱) SQL — Supabase → SQL Editor → کل `patch-60-modules-access.sql` → Run

### ۲) استخراج zip روی ریشهٔ پروژه

`patch-60-modules-access.zip` را داخل پوشهٔ پروژه Extract کن (Extract Here) —
این فایل‌ها سر جایشان می‌نشینند:

| فایل | وضعیت |
| --- | --- |
| `lib/admin/modules.ts` | جدید — رجیستری ماژول‌ها + منطق دسترسی |
| `app/admin/access/page.tsx` | جدید |
| `app/admin/access/AccessManager.tsx` | جدید |
| `app/api/admin/access/route.ts` | جدید |
| `proxy.ts` | جایگزین کامل (۵۹-ج + گیت ماژولار) |
| `lib/admin/roles.ts` | جایگزین کامل (گاردها با لیست دلخواه) |
| `app/api/admin/whoami/route.ts` | جایگزین کامل (به‌همراه `paths`) |
| `app/admin/layout.tsx` | جایگزین کامل (منو/گارد ماژولار + آیتم 🧩) |

> اگر ابزار استخراج پرسید Replace/Overwrite → بله.

### ۳) layout.tsx هم آماده است — ویرایش دستی لازم نیست

`app/admin/layout.tsx` با هر چهار تغییر (آیتم منوی 🧩، state، خواندن `paths` از
whoami، و منو/گارد با لیست دلخواه) **داخل zip موجود است** و با استخراج، جایگزین
می‌شود. اسنیپت‌های پایین فقط برای مرجع/اگر استخراج فایل را نپذیرفت:

**اسنیپت ۱ — آیتم منوی جدید** (در گروه «عملیات روزانه»، بعد از کاربران):
```ts
// پیدا کن:
      { href: '/admin/users', label: 'کاربران و دسترسی', icon: '🔐' },
// این را بعدش اضافه کن:
      { href: '/admin/access', label: 'دسترسی ماژول‌ها', icon: '🧩' },
```

**اسنیپت ۲ — state جدید** (بعد از تعریف role):
```ts
// پیدا کن:
  const [role, setRole] = useState<OpRole | null>(null)
// این را بعدش اضافه کن:
  // 🎯 پچ ۶۰: لیست دلخواه ماژول‌های این کاربر از whoami — null یعنی هنوز نیامده
  const [allowedPaths, setAllowedPaths] = useState<string[] | null>(null)
```

**اسنیپت ۳ — خواندن paths از whoami**:
```ts
// پیدا کن:
          .then((d) => {
            if (mounted && d?.role) setRole(d.role as OpRole)
          })
// جایگزین کن با:
          .then((d) => {
            if (!mounted || !d?.role) return
            setRole(d.role as OpRole)
            // 🎯 پچ ۶۰: paths = [] یعنی «پیش‌فرض نقش»
            setAllowedPaths(
              Array.isArray(d.paths) ? (d.paths as string[]) : null
            )
          })
```

**اسنیپت ۴ — منو و گارد با لیست دلخواه** (کل بلوک از کامنت «گارد نقش» تا انتهای
visibleGroups را جایگزین کن):
```ts
// پیدا کن (از «گارد نقش» تا انتهای visibleGroups):
  // 🎯 پچ ۵۶: گارد نقش — اگر مسیر فعلی برای نقش مجاز نبود، به داشبورد برگرد
  // (سمت سرور هم صفحات و APIهای حساس گارد دارند؛ این لایه UI است)
  useEffect(() => {
    if (checking || !role) return
    if (pathname === '/admin/login' || pathname === '/admin') return
    if (!roleAllowsPath(role, pathname)) router.replace('/admin')
  }, [role, pathname, checking])

  // 🎯 پچ ۵۶: منوی هر نقش — گروه خالی هم حذف می‌شود
  const visibleGroups = (
    role
      ? MENU_GROUPS.map((g) => ({
          key: g.key,
          label: g.label,
          items: g.items.filter((it) => roleAllowsPath(role, it.href)),
        }))
      : [...MENU_GROUPS.map((g) => ({ ...g, items: [...g.items] }))]
  ).filter((g) => g.items.length > 0)

// جایگزین کن با:
  // 🎯 پچ ۶۰: تک‌منبع تصمیم منو و گارد مسیر — لیست دلخواهِ کاربر اگر ثبت شده
  // باشد ملاک است، وگرنه پیش‌فرض نقش (تا رسیدن whoami، منو کامل دیده می‌شود)
  const menuAllows = (href: string) => {
    if (allowedPaths && allowedPaths.length > 0) {
      if (href === '/admin' || href === '/admin/login') return true
      return allowedPaths.some(
        (p) => href === p || href.startsWith(p + '/')
      )
    }
    if (!role) return true
    return roleAllowsPath(role, href)
  }

  // 🎯 پچ ۵۶: گارد نقش — اگر مسیر فعلی مجاز نبود، به داشبورد برگرد
  // (سمت سرور هم پروکسی و گاردهای نقش گارد دارند؛ این لایه UI است)
  useEffect(() => {
    if (checking) return
    if (pathname === '/admin/login' || pathname === '/admin') return
    if (!menuAllows(pathname)) router.replace('/admin')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, allowedPaths, pathname, checking])

  // 🎯 پچ ۵۶/۶۰: منوی هر کاربر — گروه خالی هم حذف می‌شود
  const visibleGroups = MENU_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: g.items.filter((it) => menuAllows(it.href)),
  })).filter((g) => g.items.length > 0)
```

### ۴) کامیت و دیپلوی

```powershell
npm run build        # کنترل محلی (اختیاری ولی توصیه‌شده)
git add -A
git commit -m "60: per-user modular menu access (ticks) + server-side module gate"
git push
```
(اگر روی شاخه‌ای هستی، PR → Merge؛ اگر مستقیم روی main کار می‌کنی، push همان دیپلوی است.)

## تست بعد از دیپلوی

1. با **مالک** وارد شو → منوی 🧩 «دسترسی ماژول‌ها» → کاربر c2 را باز کن → چیزی
   تیک نزده → باید «پیش‌فرض نقش» با تیک‌های صندوق‌دار از قبل باشد
2. تیک‌ها را کم/زیاد کن (مثلاً فقط سفارش‌ها، شیفت‌ها و مشتریان) → 💾 ذخیره → «✓ ذخیره شد»
3. خروج → ورود با **c2** → سایدبار فقط همان بخش‌ها را نشان می‌دهد؛ اگر آدرس
   `/admin/accounting` را دستی بزنی → به داشبورد برمی‌گردی
4. سفارش تستی + تسویه → چرخهٔ شیفت مثل قبل سالم باشد
5. «بازگشت به پیش‌فرض نقش» → ذخیره → ورود دوباره → منوی پیش‌فرض صندوق‌دار برگشته باشد
6. با مالک: همهٔ منوها مثل قبل (مالک سلب‌ناپذیر)

## بازگشت (Rollback)

- داده‌ای: در صفحهٔ دسترسی‌ها «بازگشت به پیش‌فرض نقش» → ذخیره (allowed_paths خالی → ماتریس نقش)
- کد: `git revert <کامیت پچ ۶۰>` — ستون دیتابیس بی‌ضرر می‌ماند (خوانده نمی‌شود)

## نکته

- هر بخش جدید پنل باید به `ADMIN_MODULES` در `lib/admin/modules.ts` اضافه شود تا
  در صفحهٔ دسترسی‌ها بیاید (مسیر ناشناخته برای کاربر غیرمالک بسته است — fail-closed)
- SQL پچ ۵۹-ب (سیاست RLS سطرِ خود) همچنان توصیه‌شده ولی با سرویس‌کلید اختیاری است

## نقشهٔ راه
- **پچ ۶۱**: پروفایل کارمند (سوابق شیفت/سفارش) + ورود شیفت با موبایل کارمند +
  اصلاح نوع «سرمایه» در حسابداری
