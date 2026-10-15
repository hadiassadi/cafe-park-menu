# 📋 PROJECT_STATE.md — کافه پارک

> این فایل سند زنده پروژه است. هر بار که تغییری اعمال شد،
> بخش «۵. کارهای باقی‌مانده»، «۸. لاگ تغییرات» و «بالای فایل» رو آپدیت کن.
> در چت جدید، فقط همین فایل را برای AI پیوست کن.

**آخرین آپدیت:** ۱۴۰۵/۰۷/۲۴ (2026-10-17)

---

## 🎯 ۱. خلاصه پروژه

- **نام پکیج:** `cafe-park-menu` (پوشه پروژه: `Cofe-Park`)
- **تکنولوژی:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase + `globals.css` (بدون Tailwind)
- **هدف:** مشتری‌ها با اسکن QR روی میز، منو را باز می‌کنند، سفارش می‌دهند و از طریق واتساپ به کافه می‌فرستند. صاحب کافه هم از پنل ادمین، سفارش‌ها، منو، میزها، تم‌ها و تنظیمات را مدیریت می‌کند.
- **دیتابیس:** Supabase (PostgreSQL) + Realtime برای لیست سفارش‌ها + **Polling برای اعلان‌ها**
- **ریپازیتوری:** `https://github.com/hadiassadi/cafe-park-menu.git` (branch: `main`)
- **مسیر لوکال:** `D:\Cafe Park\Menu\New Menu\CafePark-Menu\Cofe-Park`

---

## 🗂️ ۲. ساختار پروژه

```
Cofe-Park/
├── app/
│   ├── page.tsx                    ← صفحه اصلی (SSR + JSON-LD)
│   ├── MenuClient.tsx              ← کلاینت منوی مشتری
│   ├── layout.tsx                  ← Root Layout (فونت + متادیتای SEO)
│   ├── globals.css                 ← ✅ تنها فایل استایل پروژه (۷۱ بخش)
│   ├── manifest.ts                 ← PWA Manifest
│   ├── robots.ts                   ← robots.txt
│   ├── sitemap.ts                  ← sitemap.xml
│   ├── cart/page.tsx               ← صفحه سبد خرید
│   ├── checkout/page.tsx           ← صفحه ثبت سفارش + کوپن
│   ├── order/[id]/page.tsx         ← جزئیات سفارش مشتری + لغو با دلیل
│   ├── api/
│   │   ├── orders/
│   │   │   ├── route.ts            ← API ثبت سفارش + محاسبه کوپن
│   │   │   └── cancel/route.ts     ← API لغو سفارش (مشتری) + ثبت دلیل
│   │   ├── coupons/
│   │   │   ├── validate/route.ts   ← اعتبارسنجی کوپن
│   │   │   ├── stats/route.ts      ← آمار کوپن‌ها
│   │   │   └── orders/route.ts     ← سفارش‌های هر کوپن
│   │   ├── cancellation-reasons/
│   │   │   └── route.ts            ← ✅ لیست دلایل لغو فعال
│   │   ├── cancellations/
│   │   │   └── stats/route.ts      ← ✅ آمار لغوها (شامل byHour/byWeekday/byCategory)
│   │   └── export/
│   │       └── orders/route.ts     ← خروجی CSV سفارش‌ها
│   ├── components/
│   │   ├── ProductDetailModal.tsx  ← مودال جزئیات محصول
│   │   ├── CartFloatingBar.tsx     ← نوار شناور سبد
│   │   ├── ServiceWorkerRegister.tsx ← ثبت Service Worker
│   │   ├── PWAInstallPrompt.tsx    ← دکمه نصب PWA
│   │   └── Modal.tsx               ← مودال عمومی ادمین
│   └── admin/
│       ├── layout.tsx              ← سایدبار + منوی موبایل + اعلان سفارش
│       ├── login/                  ← لاگین (LoginForm + page با metadata)
│       ├── page.tsx                ← داشبورد با آمار فروش پیشرفته
│       ├── orders/                 ← مدیریت سفارش‌ها + لغو با دلیل + فاکتور
│       ├── products/               ← مدیریت محصولات (+ coupon_eligible)
│       ├── categories/             ← مدیریت دسته‌ها (+ coupon_eligible)
│       ├── tables/                 ← مدیریت میزها + QR
│       ├── themes/                 ← تم‌ها
│       ├── quotes/                 ← جملات
│       ├── coupons/                ← مدیریت کدهای تخفیف
│       │   └── reports/            ← گزارش پیشرفته کوپن‌ها
│       ├── cancellation-reasons/   ← ✅ مدیریت دلایل لغو
│       │   ├── page.tsx
│       │   ├── CancellationReasonsManager.tsx
│       │   └── actions.ts
│       ├── cancellations/          ← ✅ آمار و گزارش لغوها (کارت‌های کلیک‌پذیر + مودال)
│       │   ├── page.tsx
│       │   └── CancellationsManager.tsx
│       ├── components/
│       │   ├── CleanupOrdersCard.tsx ← پاکسازی سفارش‌های قدیمی
│       │   ├── AdminThemeToggle.tsx  ← دکمه تغییر تم شبانه/روز
│       │   ├── NewOrderAlert.tsx     ← کارت هشدار سفارش جدید
│       │   └── PrintInvoice.tsx      ← کامپوننت چاپ قابل استفاده مجدد
│       └── settings/               ← تنظیمات کامل
├── lib/
│   ├── menu-types.ts               ← تایپ‌ها + DEFAULT_THEME + Coupon
│   ├── cart-context.tsx            ← Context سبد خرید
│   ├── menu.ts                     ← getMenuData() + getSettings()
│   ├── site.ts                     ← SITE_URL
│   ├── stats.ts                    ← آمار فروش + کوپن + ✅ لغوها (شامل byHour/byWeekday/byCategory) + دلایل
│   ├── use-order-notifications.ts  ← هوک اعلان سفارش (Polling)
│   ├── use-document-title.ts       ← هوک تایتل + favicon داینامیک
│   └── supabase/
│       ├── client.ts               ← supabaseBrowser()
│       └── server.ts               ← supabaseServer()
├── public/
│   ├── sw.js                       ← Service Worker
│   ├── favicon.ico                 ← (در ریشه public)
│   └── icons/
│       ├── source-logo.png         ← منبع آیکون‌ها (شفاف)
│       ├── icon-192.png
│       ├── icon-512.png
│       ├── android-chrome-512x512.png
│       ├── apple-touch-icon.png
│       ├── favicon-16x16.png
│       └── favicon-32x32.png
├── scripts/
│   ├── backup.mjs                  ← بکاپ لوکال
│   ├── backup-server.mjs           ← بکاپ کامل سرور
│   ├── schedule-backup.mjs         ← بکاپ خودکار هر ۲۴ ساعت
│   ├── generate-icons.mjs          ← ساخت آیکون‌های PWA
│   ├── make-transparent.mjs        ← شفاف‌سازی آیکون‌ها
│   └── build-icons.mjs             ← ساخت همه سایزها از یک منبع
├── proxy.ts                        ← محافظت سرور-side از /admin
├── schema.sql
├── package.json
├── next.config.ts                  ← poweredByHeader: false
├── PROJECT_STATE.md
├── dev.bat                         ← منوی توسعه
├── end-of-day.bat                  ← اسکریپت پایان روز
├── .gitattributes                  ← خط‌پایان‌های یکسان
├── .gitignore
├── backups/                        ← بکاپ‌های لوکال (git ignore)
└── backups-server/                 ← بکاپ‌های سرور (git ignore)
```

---

## 🎨 ۳. سیستم طراحی (Design System)

**🚨 قانون حیاتی:** تمام استایل‌ها فقط در `app/globals.css` هستند. **هیچ Tailwind و هیچ CSS Module وجود ندارد.** اگر کلاس جدیدی به JSX اضافه شد، **باید در `globals.css` هم تعریف شود** — در غیر این صورت صفحه به‌هم می‌ریزد (بزرگ‌ترین اشتباه تکرارشده این پروژه).

### پالت رنگ اصلی:
| متغیر | مقدار پیش‌فرض | کاربرد |
|---|---|---|
| `--primary-color` | `#6b4f3a` | قهوه‌ای تیره (دکمه‌ها، تیترها) |
| `--accent-color` | `#9a6b3f` | قهوه‌ای روشن (قیمت‌ها) |
| `--background-color` | `#fffdf9` (theme) / `#f7f3eb` (ادمین) | کرم (پس‌زمینه) |
| `--surface-color` | `#ffffff` | کارت‌ها |
| `--text-color` | `#29251f` | خاکستری تیره |
| `--muted-text-color` | `#766f64` | خاکستری متوسط |
| `--secondary-color` | `#f3eee7` (theme) / `#e3ddd2` (ادمین) | بوردها |
| **رنگ تخفیف** | `#2d5d3e` | متن تخفیف‌ها (سبز) |
| **رنگ کوپن غیرفعال / لغو** | `#9b3c32` | هشدارها، بج‌های منفی، لغو |
| **رنگ اعلان** | `#dc2626` / `#ef4444` (dark) | Badge و Alert سفارش جدید |

### رنگ‌های Dark Mode (پنل ادمین):
```css
--admin-bg: #1a1815;
--admin-surface: #24211c;
--admin-surface-2: #2d2924;
--admin-border: #3a352c;
--admin-text: #f0e9df;
--admin-text-muted: #9a9287;
--admin-primary: #a88264;
```

### فونت‌ها:
- **پیش‌فرض:** `Vazirmatn` (از `next/font/local`، متغیر `--font-vazir`)
- **سفارشی:** از دیتابیس (جدول `themes`، فیلد `font_metadata`)

### کلاس‌های کلیدی:

**پنل ادمین:** `.admin-shell` / `.admin-sidebar` / `.admin-main` / `.admin-mobile-nav` / `.admin-header` / `.admin-card` / `.btn` / `.field` / `.info-card` / `.info-row`

**کارت‌های سفارش:** `.orders-grid` / `.order-card` / `.order-header` / `.order-body` / `.order-actions` / `.btn-approve` / `.btn-cancel`

**مودال‌ها:** `.modal-overlay` / `.modal-container` / `.modal-body` / `.modal-footer` / `.product-modal-overlay` / `.product-modal-image`

**منوی مشتری:** `.theme-root` / `.hero` / `.sticky-head` / `.toolbar` / `.cats` / `.grid` / `.product` / `.cart-floating-bar`

**سبد و ثبت سفارش:** `.cart-page` / `.cart-item` / `.qty-selector` / `.checkout-page` / `.checkout-card` / `.checkout-field` / `.checkout-btn`

**صفحه جزئیات سفارش:** `.order-detail-container` / `.status-stepper` / `.step-item` / `.info-card` / `.sticky-action-bar` / `.btn-whatsapp` / `.order-cancel-section`

**کوپن:** `.coupons-grid` / `.coupon-card` / `.coupon-code` / `.coupon-badge` / `.coupon-input-row` / `.coupon-applied` / `.coupon-selector` / `.coupon-option` / `.coupon-toggle-card` / `.item-badge.badge-eligible` / `.item-badge.badge-ineligible`

**داشبورد:** `.chart-card` / `.chart-bars` / `.chart-col` / `.chart-bar` / `.top-products-list` / `.top-product-item` / `.cleanup-card` / `.comparison-grid` / `.comparison-card` / `.peak-hours`

**دارک مود:** `.admin-shell.dark-mode` + تمام کلاس‌های override شده

**اعلان سفارش:** `.admin-nav-badge` / `.admin-mobile-badge` / `.new-order-alert-container` / `.new-order-alert` / `.new-order-alert-view` / `.new-order-alert-close`

**گزارش کوپن:** `.coupon-report-summary` / `.coupon-report-stat` / `.coupon-report-table` / `.coupon-report-table-header` / `.coupon-report-search` / `.coupon-report-row-clickable` / `.coupon-chart` / `.coupon-chart-row` / `.coupon-chart-bar` / `.coupon-orders-list` / `.coupon-order-item` / `.coupon-order-items` / `.coupon-order-actions`

**دلایل لغو:** `.reasons-grid` / `.reason-card` / `.reason-icon` / `.reason-target` / `.reason-status` / `.reason-card-actions`

**مودال لغو:** `.cancel-reasons-list` / `.cancel-reason-item` / `.cancel-reason-icon` / `.cancel-reason-label` / `.cancel-reason-check` / `.cancel-note-field` / `.cancel-warning`

**نمایش دلیل لغو:** `.cancellation-info-box` / `.cancellation-info-label` / `.cancellation-info-note` / `.cancellation-info-by`

**آمار لغوها:** `.cancellation-summary-grid` / `.cancellation-summary-card` / `.cancellation-summary-icon` / `.cancellation-reasons-chart` / `.cancellation-chart-row` / `.cancellation-chart-bar` / `.cancellation-table` / `.cancellation-reason-badge` / `.cancellation-by.by-customer` / `.cancellation-by.by-admin` / `.cancellation-row-clickable`

**آمار پیشرفته لغو:** `.cancel-wide-chart` / `.cancel-peak-bar` / `.cancel-chart-hint`

**کارت‌های گزارش:** `.report-cards-grid` / `.report-card` / `.report-card-icon` / `.report-card-body` / `.report-card-title` / `.report-card-value` / `.report-card-hint` / `.report-card-arrow`

**مشتریان (CRM):** `.customers-summary-grid` / `.customers-summary-card` / `.customers-grid` / `.customer-card` / `.customer-avatar` / `.customer-badge` / `.customer-action-btn` / `.preset-tag-btn` / `.custom-tag` / `.customer-notes-input`

### شماره‌گذاری بخش‌های `globals.css`:
| بخش | عنوان |
|---|---|
| 1 | RESET & BASE |
| 2-10 | PUBLIC MENU (Hero, Toolbar, Categories, Grid, Footer) |
| 11-17 | ADMIN SHELL + DASHBOARD + PRODUCTS + CATEGORIES |
| 18-21 | ADMIN QUOTES + SETTINGS + THEMES |
| 22-27 | MODAL + IMAGE/FONT UPLOAD + ICON PICKER |
| 28-32 | CATEGORY ICONS + PUBLIC MENU POLISH + ALL MENU SHEET |
| 33-36 | ADMIN LOGIN + SETTINGS + HERO IMAGE + CONTACT |
| 37 | ADMIN ORDERS LIST |
| 38 | ORDER DETAILS PAGE |
| 39 | ADMIN TABLES |
| 40 | PRODUCT MODAL + CART BAR + BADGES |
| 41 | CART PAGE |
| 42 | CHECKOUT PAGE |
| 43 | PRINT INVOICE |
| 44 | PWA INSTALL PROMPT |
| 45 | ADMIN DASHBOARD - SALES STATS |
| 46 | ORDER CANCEL (لغو سفارش توسط مشتری) |
| 47 | CLEANUP ORDERS (پاکسازی سفارش‌های قدیمی) |
| 48 | ADMIN COUPONS |
| 49 | CHECKOUT COUPON |
| 50 | COUPON ELIGIBILITY (تنظیمات تخفیف) |
| 51 | CHECKOUT ITEMS ELIGIBILITY |
| 52 | ORDER DISCOUNT DISPLAY |
| 53 | PRINT INVOICE - IMPROVEMENTS |
| 54 | ADMIN DARK MODE |
| 55 | ADMIN DARK MODE - FIXES |
| 56 | ADMIN ORDER NOTIFICATIONS |
| 57 | NEW ORDER ALERT |
| 58 | DYNAMIC DOCUMENT TITLE + FAVICON |
| 59 | COUPON REPORTS (کارت‌های خلاصه + جدول + نمودار) |
| 60 | COUPON REPORTS - DETAILS (جستجو + ردیف‌های کلیک) |
| 61 | COUPON ORDER DETAILS (ریز اقلام + دکمه‌های اقدام) |
| 62 | EXPORT ORDERS (خروجی Excel) |
| 63 | ADMIN DASHBOARD - ADVANCED STATS |
| 64 | ADMIN CUSTOMERS (CRM) |
| 65 | ADMIN CANCELLATION REASONS (دلایل لغو) |
| 66 | CANCEL REASONS (دلایل لغو در مودال) |
| 67 | CANCELLATION INFO (نمایش دلیل لغو) |
| 68 | CANCELLATION STATS (آمار لغوها) |
| 69 | CANCELLATION ROW CLICKABLE + PRINT |
| 70 | CANCELLATION STATS - ADVANCED (آمار پیشرفته لغوها) |
| 71 | REPORT CARDS (کارت‌های گزارش تفصیلی) |

---

## ✅ ۴. کارهای انجام‌شده

### منوی مشتری
- [x] صفحه اصلی با هدر داینامیک + JSON-LD
- [x] جستجوی فارسی (نرمال‌سازی ي/ك، ارقام، نیم‌فاصله)
- [x] فیلتر «پیشنهاد کافه» + فیلتر دسته‌بندی (Sticky)
- [x] شیت «کل منو» (Bottom Sheet روی موبایل)
- [x] کارت محصول با عکس، قیمت، اندازه، بج‌ها
- [x] مودال جزئیات محصول (تنوع‌ها، آلرژن‌ها، اطلاعات رژیمی)
- [x] ارسال به سبد + نوار شناور سبد
- [x] صفحه سبد خرید
- [x] صفحه ثبت سفارش + ارسال به `/api/orders`
- [x] صفحه جزئیات سفارش با استپر وضعیت + polling هر ۱۰ ثانیه
- [x] **لغو سفارش توسط مشتری** با شمارش معکوس ۵ دقیقه‌ای + **انتخاب دلیل**
- [x] **کد تخفیف (کوپن)** با تشخیص اقلام واجد/غیرواجد
- [x] ارسال سفارش به واتساپ

### پنل ادمین
- [x] Layout با سایدبار دسکتاپ + منوی موبایل
- [x] لاگین + **محافظت سرور-side با `proxy.ts`** + متادیتای `noindex`
- [x] **داشبورد با آمار پیشرفته** (۶ کارت + نمودار ۷ روزه + ۶ ماهه + ساعات پرترافیک + مقایسه ماه قبل + پرفروش‌ترین محصولات)
- [x] **پاکسازی سفارش‌های قدیمی** (دستی با تأیید)
- [x] مدیریت سفارش‌ها + Realtime + فیلتر + فاکتور چاپی + **لغو با دلیل**
- [x] مدیریت محصولات + تنوع‌ها + عکس + `coupon_eligible`
- [x] مدیریت دسته‌ها + `coupon_eligible`
- [x] مدیریت میزها + QR Code + دانلود PNG
- [x] مدیریت تم‌ها (رنگ + فونت)
- [x] مدیریت جملات
- [x] **مدیریت کدهای تخفیف** (CRUD + toggle + وضعیت‌ها)
- [x] **گزارش پیشرفته کوپن‌ها** — کارت‌های خلاصه + جدول جستجوپذیر + نمودار + مودال سفارش‌ها + ریز اقلام + پرینت تک سفارش
- [x] **خروجی Excel/CSV از سفارش‌ها** با فیلتر زمانی و وضعیت + پشتیبانی Excel فارسی
- [x] **CRM (مشتریان)** — گرید مشتریان + آمار + تگ + یادداشت + تماس/واتساپ
- [x] **مدیریت دلایل لغو** — CRUD با هدف (مشتری/ادمین/هر دو) + آیکون + ترتیب
- [x] **آمار و گزارش لغوها** — کارت‌های خلاصه + نمودار دلایل + نمودار ۷ روزه + جدول لغوهای اخیر + مودال جزئیات + پرینت فاکتور لغو
- [x] **آمار پیشرفته لغوها** — نمودار ساعت شبانه‌روز + روز هفته + دسته‌بندی محصولات (با هایلایت پرلغوترین)
- [x] **بازطراحی صفحه آمار لغوها** — خلاصه + کارت‌های گزارش کلیک‌پذیر + مودال جزئیات
- [x] تنظیمات کامل (هدر، پس‌زمینه، اطلاعات تماس، لوگو)
- [x] **دارک مود پنل ادمین** — با ذخیره در localStorage + بدون flash
- [x] **اعلان سفارش جدید** — Badge + صدا + Toast + Browser Notification + Polling هر ۱۰ ثانیه
- [x] **تایتل داینامیک + favicon** با شمارش سفارش‌ها

### زیرساخت و ابزارها
- [x] سیستم تم داینامیک از دیتابیس
- [x] Supabase Server + Browser Client
- [x] Cart Context با localStorage
- [x] اسکریپت بکاپ لوکال + سرور
- [x] بکاپ خودکار (`schedule-backup.mjs`)
- [x] `dev.bat` + `end-of-day.bat` (UI انگلیسی + ایموجی)
- [x] `PROJECT_STATE.md` + `.gitignore` + `.gitattributes`
- [x] **PWA کامل** (manifest + service worker + install prompt)
- [x] **بهبود SEO** (metadata داینامیک + OpenGraph + Twitter + Sitemap + robots.txt + JSON-LD)
- [x] اسکریپت‌های ساخت/شفاف‌سازی آیکون (`generate-icons.mjs`, `make-transparent.mjs`, `build-icons.mjs`)
- [x] **امنیت:** `poweredByHeader: false` + `proxy.ts` (محافظت ادمین) + `noindex` روی صفحات ادمین

### رفع باگ‌ها
- [x] رفع بزرگ شدن عکس محصول در مودال (بخش ۴۰)
- [x] رفع به‌هم‌ریختگی صفحه سبد خرید (بخش ۴۱)
- [x] رفع به‌هم‌ریختگی صفحه ثبت سفارش (بخش ۴۲)
- [x] رفع به‌هم‌ریختگی صفحه مدیریت میزها (بخش ۳۹)
- [x] رفع به‌هم‌ریختگی لیست سفارش‌های ادمین (بخش ۳۷)
- [x] رفع به‌هم‌ریختگی صفحه جزئیات سفارش (بخش ۳۸)
- [x] رفع باگ بکاپ دوبل در `backup.mjs --clean`
- [x] رفع مشکل Git (pull --rebase قبل از push)
- [x] رفع RLS جدول `coupons`، `customers` و `cancellation_reasons`
- [x] رفع فونت و ظاهر فاکتور چاپی (بخش ۴۳)
- [x] رفع مشکل Service Worker در dev (فقط production)
- [x] رفع نمایش ستون تخفیف در فاکتور چاپی
- [x] رفع کارت‌های تیره مونده در دارک مود (بخش ۵۵)
- [x] **جایگزینی Realtime با Polling** برای اعلان سفارش (به دلیل تحریم WebSocket در ایران)
- [x] **جایگزینی `middleware.ts` با `proxy.ts`** (تغییر convention در Next.js 16)
- [x] رفع باگ تایپی `/* } */` در CSS (باعث خراب شدن بخش CRM شده بود)
- [x] رفع خطای `updated_at` در جدول `customers`
- [x] **رفع خطای `Expression expected` در `stats.ts`** (به‌خاطر return تکراری)
- [x] **رفع خطای `Cannot read properties of undefined` در `CancellationsManager`** — استفاده از fallback برای دیتای قدیمی + `cache: 'no-store'` در fetch

---

## 🚧 ۵. کارهای باقی‌مانده

> اولویت‌ها: 🔴 بالا / 🟡 متوسط / 🟢 پایین

- [ ] 🔴 **تست کامل روی موبایل واقعی** (iOS Safari + Chrome Android)
- [ ] 🔴 **تست کامل جریان سفارش** از ابتدا تا انتها
- [ ] 🟡 **پاکسازی خودکار سفارش‌های قدیمی** با Cron Job در Supabase
- [ ] 🟢 **گزارش فروش روزانه Excel/CSV** (نسخه پیشرفته‌تر برای مالیات)
- [ ] 🟢 **فیلتر تعداد لغو** در صفحه مشتریان (۱+، ۳+، ۵+)
- [ ] 🟢 **پنل مشتری** — ثبت‌نام با شماره و مشاهده تاریخچه سفارش‌ها
- [ ] 🟢 **ایمیل/SMS اطلاع‌رسانی** برای سفارش‌های جدید
- [ ] 🟢 **تست بار (Load Test)** روی Supabase
- [ ] 🟢 **آیکون و عنوان PWA** با badge (مشتری)
- [ ] 🟢 **اتصال به درگاه پرداخت** (زرین‌پال / آیدی‌پی)
- [ ] 🟢 **اتصال به نرم‌افزار حسابداری پارسیان** (با واسط محلی)
- [ ] 🟢 **سیستم پیامک (SMS)** برای OTP و اطلاع‌رسانی لغو

---

## 🔑 ۶. قوانین طلایی کدنویسی

1. 🚨 **هر کلاس جدید در JSX باید حتماً در `globals.css` تعریف شود.**
2. **نام کلاس‌ها با BEM-like:** `block-element` یا `block-element-modifier`
3. **هیچ استایل inline نداشته باشیم**، مگر برای مقادیر داینامیک از theme
4. **همه چیز از پالت رنگ بخش ۳ استفاده کند**
5. **روی موبایل تست شود** — breakpoint‌ها: `650px`, `768px`, `640px`, `500px`
6. **برای همه مودال‌ها از `modal-overlay` + `modal-container` استفاده شود**
7. **قبل از ارسال به چت جدید، فایل `PROJECT_STATE.md` را پیوست کن.**
8. **بعد از هر تغییر مهم، `Ctrl+Shift+R` رفرش کن.**
9. **همه متن‌های `.bat` به انگلیسی + ایموجی باشند** (CMD فارسی را RTL رندر نمی‌کند).
10. **برای سرور از `supabaseServer()`، برای کلاینت از `supabaseBrowser()` استفاده شود.**
11. **در کوئری‌های Supabase، همیشه ستون‌های جدید را به `select` اضافه کن.**
12. **برای اعلان‌ها، از Polling استفاده شود (نه Realtime)** — به دلیل تحریم ایران.
13. **متن‌های کامنت CSS رو کپی نکن** — فقط کد ناب رو در `globals.css` بذار.
14. **در fetch های API از `cache: 'no-store'` استفاده کن** — برای جلوگیری از کش شدن دیتای قدیمی.

---

## 📝 ۷. متن آماده برای شروع چت جدید

> هر بار که می‌خواهی چت جدید بزنی، این متن را کپی کن و فایل `PROJECT_STATE.md` را ضمیمه کن:

```
سلام. من روی پروژه «کافه پارک» (Next.js 16 + Supabase + globals.css) کار می‌کنم.
فایل PROJECT_STATE.md وضعیت کامل پروژه، سیستم طراحی، کلاس‌های CSS و کارهای باقی‌مانده را توضیح می‌دهد.
لطفاً قبل از هر کاری، این فایل را کامل بخوان و بر اساس آن ادامه بده.

⚠️ قوانین حیاتی:
1. تمام استایل‌ها فقط در app/globals.css هستند (بدون Tailwind).
2. هر کلاس جدیدی که در JSX استفاده می‌شود، باید در globals.css تعریف شود.
3. پالت رنگ از متغیرهای CSS می‌آید، نه رنگ hex مستقیم.
4. مودال‌ها از کلاس‌های modal-overlay + modal-container استفاده کنند.
5. بخش‌های globals.css شماره‌گذاری شده‌اند (۱ تا ۷۱).
6. برای اعلان‌ها از Polling استفاده شود، نه Realtime (تحریم ایران).
7. محافظت ادمین با proxy.ts (نه middleware.ts در Next.js 16).
8. در fetch های API از cache: 'no-store' استفاده شود.

📁 ابزارهای موجود در پروژه:
- dev.bat → منوی همه‌کاره توسعه (۱۶ گزینه)
- end-of-day.bat → اسکریپت پایان روز (بکاپ + pull + push)
- npm run backup / backup:server / backup:clean
- npm run build:icons / transparent

درخواست فعلی من:
[اینجا درخواستت را بنویس]
```

---

## 📅 ۸. لاگ تغییرات

| تاریخ | تغییر |
|---|---|
| 1405/07/19 | پیاده‌سازی کامل منوی مشتری + سبد خرید + ثبت سفارش |
| 1405/07/19 | پیاده‌سازی پنل ادمین (سفارش‌ها، محصولات، دسته‌ها، میزها، تم‌ها، جملات، تنظیمات) |
| 1405/07/19 | افزودن QR Code به میزها |
| 1405/07/19 | رفع به‌هم‌ریختگی همه صفحات ادمین و منو (بخش‌های ۳۷-۴۲) |
| 1405/07/19 | ایجاد PROJECT_STATE.md + اسکریپت‌های بکاپ |
| 1405/07/19 | افزودن dev.bat + end-of-day.bat |
| 1405/07/19 | رفع باگ بکاپ دوبل + مشکل Git |
| 1405/07/20 | افزودن دکمه چاپ فاکتور + رفع فونت و ظاهر فاکتور (بخش ۴۳) |
| 1405/07/20 | **افزودن PWA کامل** (manifest + Service Worker + install prompt) |
| 1405/07/20 | **بهبود کامل SEO** (metadata + OpenGraph + Sitemap + robots.txt + JSON-LD) |
| 1405/07/20 | شفاف‌سازی آیکون‌های PWA + انتقال favicon.ico |
| 1405/07/20 | **افزودن آمار فروش در داشبورد ادمین** (بخش ۴۵) |
| 1405/07/20 | **افزودن لغو سفارش توسط مشتری** با شمارش معکوس (بخش ۴۶) |
| 1405/07/20 | **افزودن پاکسازی سفارش‌های قدیمی** (بخش ۴۷) |
| 1405/07/21 | **افزودن سیستم کامل کد تخفیف (کوپن)** با تشخیص اقلام واجد/غیرواجد (بخش‌های ۴۸-۵۳) |
| 1405/07/21 | **افزودن max_order_amount و coupon_eligible** به کوپن‌ها، دسته‌ها و محصولات |
| 1405/07/21 | نمایش تخفیف در فاکتور چاپی + ستون تخفیف هر آیتم |
| 1405/07/21 | **افزودن دارک مود برای پنل ادمین** (بخش‌های ۵۴-۵۵) |
| 1405/07/21 | **افزودن اعلان سفارش جدید** (Badge + صدا + Toast + Browser Notification) (بخش‌های ۵۶-۵۷) |
| 1405/07/21 | **افزودن تایتل و favicon داینامیک** با شمارش سفارش‌های جدید (بخش ۵۸) |
| 1405/07/21 | **جایگزینی Realtime با Polling** برای اعلان‌ها (به دلیل تحریم ایران) |
| 1405/07/21 | **افزودن proxy.ts + حذف X-Powered-By + متادیتای صفحات ادمین** (امنیت) |
| 1405/07/22 | **افزودن گزارش پیشرفته کوپن‌ها** (بخش‌های ۵۹-۶۱) |
| 1405/07/22 | **استخراج `PrintInvoice.tsx`** به عنوان کامپوننت قابل استفاده مجدد |
| 1405/07/22 | **افزودن خروجی Excel/CSV از سفارش‌ها** برای حسابداری (بخش ۶۲) |
| 1405/07/22 | **افزودن داشبورد پیشرفته** (نمودار ۶ ماهه + ساعات پرترافیک + مقایسه ماه قبل) (بخش ۶۳) |
| 1405/07/22 | **افزودن CRM (مشتریان)** — گرید + آمار + تگ + یادداشت (بخش ۶۴) |
| 1405/07/23 | **افزودن سیستم کامل لغو سفارش** — دلایل قابل مدیریت + UI مشتری/ادمین + نمایش دلیل + آمار + فاکتور لغو (بخش‌های ۶۵-۶۹) |
| 1405/07/23 | **افزودن مودال جزئیات سفارش لغو شده** با پرینت فاکتور اختصاصی |
| 1405/07/24 | **افزودن آمار پیشرفته لغوها** — نمودار ساعت شبانه‌روز + روز هفته + دسته‌بندی محصولات (بخش ۷۰) |
| 1405/07/24 | **بازطراحی صفحه آمار لغوها** — کارت‌های گزارش کلیک‌پذیر + مودال‌های جزئیات (بخش ۷۱) |
| 1405/07/24 | **رفع خطای `Expression expected` در `stats.ts`** (return تکراری) |
| 1405/07/24 | **رفع خطای `Cannot read properties of undefined` در `CancellationsManager`** (fallback + `cache: 'no-store'`) |

---

## 🔗 ۹. دستورات مهم (Quick Reference)

### اسکریپت‌های npm:
```bash
# توسعه
npm run dev               # اجرای پروژه در حالت توسعه
npm run build             # بیلد گرفتن
npm start                 # اجرای نسخه Build شده
npm run lint              # اجرای Linter

# بکاپ
npm run backup            # بکاپ لوکال
npm run backup:clean      # پاکسازی بکاپ‌های قدیمی لوکال
npm run backup:schedule   # بکاپ خودکار لوکال (هر ۲۴ ساعت)
npm run backup:server     # بکاپ کامل سرور (شامل node_modules)
npm run backup:server:light # بکاپ سرور بدون node_modules
npm run backup:server:test  # تست بکاپ سرور

# ابزارهای تصویر
npm run icons             # ساخت آیکون‌های PWA
npm run transparent       # شفاف‌سازی آیکون‌ها
npm run build:icons       # ساخت همه سایزها از source-logo.png
```

### فایل‌های `.bat`:
```bash
dev.bat                   # منوی همه‌کاره توسعه
end-of-day.bat            # اسکریپت پایان روز
```

### Git:
```bash
git pull origin main --rebase --autostash   # قبل از push
git add . && git commit -m "پیام" && git push origin main
```

### متغیرهای محیطی (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
NEXT_PUBLIC_SITE_URL=https://cafe-park-menu.vercel.app
```

---

## 💾 ۱۰. سیستم بکاپ

### دو نوع بکاپ:

| نوع | دستور | مسیر | حجم | شامل | نگهداری |
|---|---|---|---|---|---|
| **لوکال** | `npm run backup` | `backups/` | ~0.7 MB | فقط سورس + .bat + .gitignore | ۳۰ روز |
| **سرور** | `npm run backup:server` | `backups-server/` | ~67 MB | سورس + node_modules + .env.local | ۱۴ روز |

### اسکریپت‌ها:
| اسکریپت | کاربرد |
|---|---|
| `scripts/backup.mjs` | بکاپ لوکال (فایل + zip) |
| `scripts/backup.mjs --clean` | پاکسازی بکاپ‌های قدیمی |
| `scripts/backup-server.mjs` | بکاپ کامل سرور (Flood-Fill) |
| `scripts/backup-server.mjs --no-deps` | بدون node_modules |
| `scripts/backup-server.mjs --dry-run` | فقط شمارش |
| `scripts/schedule-backup.mjs` | اجرای خودکار هر ۲۴ ساعت |

### اسکریپت‌های آیکون:
| اسکریپت | کاربرد |
|---|---|
| `scripts/generate-icons.mjs` | ساخت آیکون از رنگ + متن |
| `scripts/make-transparent.mjs` | حذف پس‌زمینه با Flood-Fill |
| `scripts/build-icons.mjs` | ساخت همه سایزها از `source-logo.png` |

---

## 🗄️ ۱۱. جداول دیتابیس (Supabase)

| جدول | کاربرد | فیلدهای کلیدی |
|---|---|---|
| `categories` | دسته‌بندی محصولات | `id`, `name`, `icon`, `sort_order`, `is_active`, `coupon_eligible` |
| `products` | محصولات | `id`, `category_id`, `name`, `price`, `image_url`, `is_featured`, `is_new`, `is_available`, `size`, `calories`, `prep_time_minutes`, `ingredients`, `allergens`, `dietary_info`, `coupon_eligible` (nullable) |
| `variant_groups` | گروه‌های تنوع | `id`, `product_id`, `name`, `is_required`, `sort_order` |
| `variant_options` | گزینه‌های هر گروه | `id`, `group_id`, `name`, `price_modifier`, `is_default`, `is_available`, `sort_order` |
| `orders` | سفارش‌ها | `id`, `order_number`, `customer_name`, `customer_phone`, `table_number`, `note`, `items` (JSONB), `subtotal`, `status`, `original_subtotal`, `coupon_code`, `coupon_discount`, `eligible_subtotal`, `ineligible_subtotal`, **`cancellation_reason_id`**, **`cancellation_reason_label`**, **`cancellation_note`**, **`cancelled_by`** ('customer'/'admin'/'system'), `created_at`, `confirmed_at`, `preparing_at`, `ready_at`, `delivered_at`, `cancelled_at` |
| `tables` | میزها | `id`, `number`, `name`, `description`, `capacity`, `location`, `sort_order`, `is_active`, `qr_token` |
| `quotes` | جملات | `id`, `text`, `author`, `is_active` |
| `themes` | تم‌ها | رنگ‌ها + font_url‌ها + `font_metadata` (JSONB), `border_radius`, `is_active` |
| `settings` | تنظیمات سایت (تک‌ردیفی، id=1) | `cafe_name`, `tagline`, `hero_*`, `footer_text`, `address`, `phone`, `instagram`, `working_hours`, `logo_url`, `maps_url`, `og_*`, `show_*`, `*_in_header/footer/floating` |
| `coupons` | کدهای تخفیف | `id`, `code`, `description`, `discount_type` ('percent'/'fixed'), `discount_value`, `min_order_amount`, `max_order_amount`, `max_discount`, `max_uses`, `used_count`, `valid_from`, `valid_until`, `is_active` |
| `customers` | مشتریان (خودکار از سفارش‌ها) | `phone`, `notes`, `tags`, `updated_at` |
| **`cancellation_reasons`** | **دلایل لغو سفارش** | `id`, `label`, `target` ('customer'/'admin'/'both'), `icon`, `sort_order`, `is_active`, `created_at`, `updated_at` |

### وضعیت سفارش‌ها (status):
```
pending    → confirmed  → preparing → ready → delivered
           ↘ cancelled  (با دلیل و cancelled_by)
```

### نحوه استفاده از coupon_eligible:
```
محصول coupon_eligible = true      → همیشه شامل تخفیف
محصول coupon_eligible = false     → هرگز شامل تخفیف
محصول coupon_eligible = null      → از دسته ارث می‌برد
دسته coupon_eligible = false      → پیش‌فرض غیرفعال (مگر override محصول)
```

### نحوه استفاده از cancellation_reasons:
```
target = 'customer'  → فقط در مودال لغو مشتری نمایش داده می‌شه
target = 'admin'     → فقط در مودال لغو ادمین نمایش داده می‌شه
target = 'both'      → در هر دو مودال
is_active = true     → فقط فعال‌ها نمایش داده می‌شن
```

### Realtime Publications:
```sql
alter publication supabase_realtime add table public.orders;

create policy "Enable realtime for orders"
  on public.orders for select using (true);
```

---

## 🛠️ ۱۲. ابزارهای توسعه

| ابزار | مسیر | کاربرد |
|---|---|---|
| **منوی توسعه** | `dev.bat` | ۱۶ گزینه (dev، build، backup، git، VS Code، ...) |
| **پایان روز** | `end-of-day.bat` | بکاپ + پاکسازی + pull + push + PROJECT_STATE |
| **بکاپ لوکال** | `scripts/backup.mjs` | فقط سورس |
| **بکاپ سرور** | `scripts/backup-server.mjs` | کامل + node_modules |
| **بکاپ خودکار** | `scripts/schedule-backup.mjs` | هر ۲۴ ساعت |
| **آیکون PWA** | `scripts/build-icons.mjs` | ساخت همه سایزها |
| **شفاف‌سازی** | `scripts/make-transparent.mjs` | حذف پس‌زمینه |
| **تغییر تم** | `app/admin/components/AdminThemeToggle.tsx` | toggle روز/شب + localStorage |
| **اعلان سفارش** | `lib/use-order-notifications.ts` | Polling هر ۱۰ ثانیه + صدا + نوتیفیکیشن |
| **کارت هشدار** | `app/admin/components/NewOrderAlert.tsx` | Toast قرمز با دکمه مشاهده |
| **تایتل داینامیک** | `lib/use-document-title.ts` | عنوان + favicon تب مرورگر |
| **کامپوننت چاپ** | `app/admin/components/PrintInvoice.tsx` | فاکتور قابل استفاده مجدد |
| **گزارش کوپن** | `app/admin/coupons/reports/CouponReports.tsx` | صفحه گزارش با نمودار و مودال سفارش‌ها |
| **دلایل لغو** | `app/admin/cancellation-reasons/` | مدیریت دلایل لغو |
| **آمار لغو** | `app/admin/cancellations/` | گزارش و تحلیل لغوها (شامل آمار پیشرفته) |
| **محافظت ادمین** | `proxy.ts` | ریدایرکت سرور-side برای /admin |

---

## 📦 ۱۳. نسخه‌های نصب‌شده

### Dependencies:
```
@supabase/ssr          ^0.5.2
@supabase/supabase-js  ^2.45.4
archiver               ^7.0.1
fontkit                ^2.0.4
next                   ^16.3.6
qrcode.react           ^4.2.0
react                  ^19.3.0
react-dom              ^19.3.0
sharp                  ^0.35.5
```

### DevDependencies:
```
@types/archiver        ^6.0.3
@types/node            ^22.10.0
@types/react           ^19.0.0
@types/react-dom       ^19.0.0
eslint                 ^9.39.0
eslint-config-next     ^16.3.6
typescript             ^5.6.3
```

---

## 📄 ۱۴. `.gitignore` و `.gitattributes`

### `.gitignore`:
```
node_modules/
.next/
.env
.env.local
.env.*.local
*.lnk

# بکاپ‌های محلی
backups/
backups-server/
```

### `.gitattributes`:
```
* text=auto eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf

*.png binary
*.jpg binary
*.jpeg binary
*.jfif binary
*.webp binary
*.ico binary
*.woff binary
*.woff2 binary
*.ttf binary
*.otf binary
*.zip binary
```

---

## 🐛 ۱۵. باگ‌های شناخته‌شده

> هیچ باگ باز فعلاً وجود ندارد.

| تاریخ | توضیح | وضعیت |
|---|---|---|
| — | — | — |

---

## 💡 ۱۶. تصمیمات فنی مهم

1. **بدون Tailwind:** تمام استایل‌ها در `globals.css` برای سادگی و کنترل کامل.
2. **Realtime Supabase:** برای لیست سفارش‌ها در ادمین.
3. **Polling برای اعلان سفارش‌ها:** به جای Realtime (به دلیل ناپایداری WebSocket در ایران) — هر ۱۰ ثانیه.
4. **Polling در صفحه جزئیات سفارش مشتری:** هر ۱۰ ثانیه.
5. **QR Token برای میزها:** با اسکن QR، `?table=N` به URL اضافه می‌شود.
6. **فونت داینامیک از دیتابیس:** ادمین می‌تواند فونت سفارشی آپلود کند.
7. **localStorage برای سبد خرید:** بدون نیاز به ثبت‌نام.
8. **واتساپ برای اطلاع‌رسانی:** نیازی به پنل پیامکی نیست.
9. **متن‌های `.bat` به انگلیسی + ایموجی:** چون CMD فارسی RTL رندر نمی‌کند.
10. **`.gitattributes` برای خط‌پایان‌ها:** جلوگیری از conflict در ویندوز/لینوکس.
11. **Service Worker فقط در production:** در `npm run dev` غیرفعال است.
12. **کوپن با ارث‌بری:** محصول تنظیمات اختصاصی دارد یا از دسته ارث می‌برد.
13. **محاسبه سهم تخفیف هر آیتم:** در API هنگام ثبت سفارش، برای نمایش در فاکتور.
14. **RLS policy برای همه جداول عمومی:** با `true` on `insert/update/select`.
15. **React Portal برای فاکتور چاپی:** تا خارج از `.admin-main` قرار بگیرد.
16. **دارک مود در localStorage:** با کلید `cafe-park-admin-theme`.
17. **صدا با AudioContext:** با اولین کلیک کاربر unlock می‌شود (محدودیت Chrome).
18. **تایتل داینامیک:** با شمارش سفارش‌های pending در `document.title`.
19. **آیکون داینامیک با canvas:** ساخت favicon با badge قرمز.
20. **`proxy.ts` به جای `middleware.ts`:** در Next.js 16 convention عوض شده. محافظت سرور-side از `/admin`.
21. **محافظت دو لایه (Defense in Depth):** `proxy.ts` (سرور) + `admin/layout.tsx` (کلاینت).
22. **`noindex, nofollow` روی صفحات ادمین:** جلوگیری از ایندکس شدن در گوگل.
23. **کامپوننت چاپ مشترک:** `PrintInvoice.tsx` در صفحه سفارش + گزارش کوپن‌ها استفاده می‌شود.
24. **گزارش کوپن‌ها با API جداگانه:** `/api/coupons/stats` و `/api/coupons/orders` برای دسترسی از Client Component.
25. **لغو با دلیل از دیتابیس:** دلایل در جدول `cancellation_reasons` قابل مدیریت از پنل ادمین هستن.
26. **لغو بدون دلیل مجاز:** فیلد دلیل اختیاریه ولی برای بهبود سرویس توصیه می‌شه.
27. **نمایش دلیل لغو به مشتری:** فقط وقتی `cancelled_by = 'admin'` باشه.
28. **لغو با تاریخچه:** هر لغو، تاریخ (`cancelled_at`) و لغوکننده (`cancelled_by`) و دلیل رو ثبت می‌کنه.
29. **CSV با فرمول `=""`:** برای جلوگیری از Scientific notation در Excel (شماره تلفن).
30. **پشتیبانی Excel فارسی:** BOM (`\uFEFF`) در ابتدای CSV.
31. **آمار لغو با نگاشت نام محصول به دسته:** چون در `orders.items` فقط `product_name` ذخیره می‌شه، برای دسته‌بندی از جدول `products` نگاشت می‌گیریم. اگه اسم محصول عوض بشه، لغوهای قبلی ممکنه نگاشت نشن.
32. **هایلایت ستون پرلغو:** با کلاس `.cancel-peak-bar` (box-shadow قرمز) برای دیده شدن سریع‌تر.
33. **نمودار عریض با اسکرول افقی:** `.cancel-wide-chart` با `min-width: 620px` تا در موبایل به‌هم نریزه.
34. **صفحه گزارش با کارت‌های کلیک‌پذیر:** به جای سکشن‌های طولانی، کارت‌های خلاصه + مودال برای جزئیات (سرعت بالاتر، DOM سبک‌تر).
35. **مودال تودرتو با z-index بالاتر:** `.nested-modal` برای باز شدن جزئیات سفارش روی گزارش.
36. **فچ API با `cache: 'no-store'`:** جلوگیری از کش شدن دیتای قدیمی در مرورگر.
37. **Fallback در کامپوننت‌های Client:** استفاده از `data?.byHour ?? []` برای جلوگیری از کرش در صورت قدیمی بودن دیتای API.