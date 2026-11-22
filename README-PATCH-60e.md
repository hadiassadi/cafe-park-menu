# پچ ۶۰-هـ — مُهر نسخه + نصب کامل و یکپارچهٔ پشتهٔ ۶۰

> تاریخ: 2026-11-22 · زمینه: whoami برای c2 درست برمی‌گرداند (`"role":"cashier"` + ۷ ماژول)
> ولی منو فیلتر نمی‌شود — یعنی کدِ دیپلوی‌شدهٔ layout/پروکسی/گیت‌ها با نسخهٔ فعلی
> یکی نیست (جایگزینی ناقص هنگام Extract محتمل‌ترین علت است). این پچ همه را یکجا
> با آخرین نسخه نصب می‌کند و مُهر نسخه می‌گذارد تا از مرورگر قابل راستی‌آزمایی باشد.

## ۱) نصب

`patch-60e-full.zip` را روی ریشهٔ پروژه Extract کن — این بار در پنجرهٔ
«Replace or Skip Files» حتماً **Replace (جایگزینی)** را بزن. اگر VS Code یا
`npm run dev` باز است، اول ببند (فایل قفل باعث Extract ناقص می‌شود).

| فایل | نقش |
| --- | --- |
| `lib/version.ts` | مُهر نسخه `60e` |
| `proxy.ts` | گیت ماژولار صفحات (مسیرهای غیرمجاز → داشبورد) |
| `app/admin/layout.tsx` | فیلتر منو با whoami + نشانگر 👤 ایمیل |
| `lib/admin/roles.ts` | getOperatorRole (نقش + مسیرها + ایمیل) و گاردها |
| `lib/admin/modules.ts` | رجیستری ماژول‌ها + accessAllowsPath |
| `lib/admin/role-matrix.ts` | ماتریس نقش‌ها |
| `app/api/admin/whoami/route.ts` | پاسخ شامل role/paths/email/**build** |
| `app/api/admin/access/route.ts` | API دسترسی‌ها (GET گیت‌دار + POST نقش فقط با مالک) |
| `app/admin/access/AccessManager.tsx` | صفحهٔ 🧩 با dropdown نقش + هشدار مالک |

```powershell
git add -A
git commit -m "60e: full 60-stack refresh + build stamp in whoami"
git push
```

بعد از push، در Vercel → Deployments ببین که آخرین دیپلوی Production با همین
پیام کامیت ساخته شده و **Ready** شده باشد.

## ۲) راستی‌آزمایی از مرورگر (تعیین‌کننده)

در پنجرهٔ ناشناس با کاربر c2:

```
https://cafe-park-menu.vercel.app/api/admin/whoami
```

- باید `"build":"60e"` و `"email":"c2@cafepark.com"` را ببینی.
- اگر `build` نبود → دیپلوی قدیمی است؛ git/Vercel را چک کن (بخش ۴).

سپس پنل را با **Ctrl+Shift+R** باز کن:

- پایین سایدبار: 👤 ایمیل کاربر واردشده دیده می‌شود
- منو فقط: داشبورد، سفارش‌ها، ثبت سفارش حضوری، شیفت‌ها، مشتریان، آمار لغوها، دلایل لغو
- `/admin/accounting` دستی → برگشت به داشبورد

## ۳) اگر build بود ولی منو باز بود

اسکرین‌شات سایدبار + خروجی دستورهای بخش ۴ را بفرست.

## ۴) تشخیص وضعیت git (قبل/بعد از نصب قابل اجراست)

```powershell
git log --oneline -5
git status --short
git show HEAD:app/admin/layout.tsx | Select-String -Pattern "whoami|menuAllows|allowedPaths"
git show HEAD:proxy.ts | Select-String -Pattern "accessAllowsPath"
```

انتظار: در خروجی دو دستور آخر باید خطوطی دیده شود. اگر خالی بود یعنی فایل در
کامیتِ push‌شده قدیمی است — یعنی Extract ناقص بوده؛ با Replace دوباره Extract کن.
