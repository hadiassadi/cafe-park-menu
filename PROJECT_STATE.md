# 📋 PROJECT_STATE.md — کافه پارک

> این فایل سند زنده پروژه است. هر بار که تغییری اعمال شد،
> بخش «۵. کارهای باقی‌مانده»، «۸. لاگ تغییرات» و «بالای فایل» رو آپدیت کن.
> در چت جدید، فقط همین فایل را برای AI پیوست کن.
> ⚠️ هیچ مقدار واقعی رازی (HASH_SALT، کلیدها) در این فایل نوشته نشود.

**آخرین آپدیت:** ۱۴۰۵/۰۸/۱۰ (2026-11-01)

---

## 🎯 ۱. خلاصه پروژه

- **نام پکیج:** `cafe-park-menu` (پوشه پروژه: `Cofe-Park`)
- **تکنولوژی:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase + `globals.css` (بدون Tailwind)
- **هدف:** مشتری‌ها با اسکن QR روی میز، منو را باز می‌کنند، سفارش می‌دهند و از طریق واتساپ به کافه می‌فرستند. صاحب کافه هم از پنل ادمین، سفارش‌ها، منو، میزها، تم‌ها و تنظیمات را مدیریت می‌کند. مشتری‌ها می‌توانند بدون کد و فقط با شناسه دستگاه (کوکی امن)، سفارش‌های قبلی خود را ببینند. سیستم پرداخت چندگانه پیاده‌سازی شده است (آنلاین زرین‌پال، پرداخت در محل، کارت‌به‌کارت با رسید). مشتری‌ها می‌توانند Web Push Notification (اعلان مرورگر) را فعال کنند و در **باشگاه مشتریان سازمانی (B2B)** ثبت‌نام کنند تا تخفیف اختصاصی دریافت کنند.
- **دیتابیس:** Supabase (PostgreSQL) + Realtime برای لیست سفارش‌ها + **Polling برای اعلان‌ها** + **pg_cron برای پاکسازی خودکار** + **Storage برای رسیدها** + **RLS کاملاً قفل‌شده برای جداول حساس**
- **ریپازیتوری:** `https://github.com/hadiassadi/cafe-park-menu.git` (branch: `main`)
- **مسیر لوکال:** `D:\Cafe Park\Menu\New Menu\CafePark-Menu\Cofe-Park`
- **دامنه پروداکشن:** `https://cafe-park-menu.vercel.app`

---

## 🗂️ ۲. ساختار پروژه

```text
Cofe-Park/
├── app/
│   ├── page.tsx                    ← صفحه اصلی (SSR + JSON-LD)
│   ├── MenuClient.tsx              ← کلاینت منوی مشتری (+ دکمه سفارش‌های من + نوار شناور سبد)
│   ├── layout.tsx                  ← Root Layout (فونت + متادیتای SEO)
│   ├── globals.css                 ← ✅ تنها فایل استایل پروژه (۹۴ بخش)
│   ├── manifest.ts                 ← PWA Manifest
│   ├── robots.ts                   ← robots.txt
│   ├── sitemap.ts                  ← sitemap.xml
│   ├── cart/page.tsx               ← صفحه سبد خرید (+ خواندن شماره میز از QR)
│   ├── checkout/page.tsx           ← ثبت سفارش + کوپن + انتخاب پرداخت + تخفیف باشگاه (payment_method همراه سفارش ارسال می‌شود)
│   ├── my-orders/                  ← ✅ پنل مشتری (داشبورد + تاریخچه + ثبت‌نام باشگاه؛ بدون OTP)
│   │   ├── page.tsx
│   │   └── MyOrdersClient.tsx      ← تاریخچه سفارش‌ها با کوکی دستگاه
│   ├── order/[id]/                 ← جزئیات سفارش مشتری + کارت فعال‌سازی Push
│   │   ├── page.tsx                ← صفحه اصلی سفارش + وضعیت پرداخت (polling هر ۵ ثانیه برای باز/قفل‌شدن دکمه‌ها)
│   │   └── UploadReceipt.tsx       ← ✅ آپلود رسید (عکس/متن + نمایش رسید قبلی + دکمه تغییر)
│   ├── payment/callback/           ← ✅ بازگشت از درگاه پرداخت
│   │   ├── page.tsx
│   │   └── PaymentCallbackClient.tsx
│   ├── api/
│   │   ├── admin/                  ← ✅ APIهای امن ادمین
│   │   │   ├── customers/route.ts  ← دریافت لیست CRM
│   │   │   ├── orders/pending/route.ts ← اعلان‌ها (واریز فقط وقتی رسید عکس/متن دارد)
│   │   │   └── memberships/        ← ✅ APIهای ادمین باشگاه (آپلود اکسل، تنظیمات، تأیید درخواست)
│   │   ├── orders/
│   │   │   ├── route.ts            ← API ثبت سفارش (کوکی دستگاه + payment_method واقعی از body + اعمال تخفیف باشگاه)
│   │   │   ├── [id]/route.ts       ← دریافت سفارش (نسخه مالکیت‌محور پیشنهاد شده؛ نصب/تست 404 باقی است)
│   │   │   └── cancel/route.ts     ← API لغو سفارش (نسخه مالکیت‌محور پیشنهاد شده؛ نصب/تست باقی است)
│   │   ├── customer/               ← ✅ API پنل مشتری (با Service Role)
│   │   │   ├── me/route.ts         ← اطلاعات دستگاه فعلی
│   │   │   └── orders/route.ts     ← سفارش‌های دستگاه فعلی
│   │   ├── membership/             ← ✅ API باشگاه (register, calculate, organizations, rules)
│   │   ├── payment/                ← ✅ API پرداخت (با Service Role)
│   │   │   ├── settings/route.ts   
│   │   │   ├── request/route.ts    
│   │   │   ├── verify/route.ts     
│   │   │   ├── set-method/route.ts ← انتخاب روش پرداخت؛ واریز را فقط unpaid می‌کند (هرگز pending_review)
│   │   │   └── upload-receipt/route.ts ← ثبت رسید + قفل سمت سرور؛ تنها مسیر ورود به pending_review
│   │   ├── push/                   ← ✅ Web Push (subscribe, send)
│   │   ├── upload-receipt/route.ts ← آپلود به Storage (Signed URL)
│   │   ├── coupons/                
│   │   ├── cancellation-reasons/   ← با Service Role
│   │   ├── cancellations/          
│   │   ├── customers/update/route.ts ← ذخیره یادداشت/تگ CRM
│   │   ├── reports/sales/route.ts  
│   │   ├── cleanup/                
│   │   └── export/                 
│   ├── components/                 
│   │   ├── EnablePushCard.tsx      ← ✅ کارت فعال‌سازی اعلان مرورگر
│   │   └── CartFloatingBar.tsx     ← ✅ نوار شناور سبد
│   └── admin/
│       ├── layout.tsx              ← هدر موبایل + drawer + اعلان سفارش
│       ├── memberships/            ← ✅ پنل مدیریت باشگاه مشتریان (سازمان‌ها، اعضا، درخواست‌ها، قوانین)
│       ├── orders/                 ← مدیریت سفارش‌ها
│       │   ├── page.tsx            ← لود مستقیم با Service Role
│       │   ├── OrdersManager.tsx   ← لیست + جستجو + فیلتر + مودال تسویه + دکمه «عدم تأیید رسید»
│       │   └── actions.ts          ← اکشن‌ها با Service Role (+ rejectReceipt)
│       ├── customers/
│       │   ├── page.tsx
│       │   └── CustomersManager.tsx ← دریافت دیتا از API امن
│       ├── settings/
│       │   ├── page.tsx
│       │   └── payment/
│       │       ├── page.tsx
│       │       ├── PaymentSettingsManager.tsx
│       │       └── actions.ts
│       ├── (بقیه صفحات ادمین بدون تغییر)
│       └── components/
│           ├── AdminMobileThemeToggle.tsx
│           └── (بقیه کامپوننت‌ها)
├── lib/
│   ├── menu-types.ts
│   ├── cart-context.tsx
│   ├── menu.ts                     ← لود تنظیمات با Service Role (سرور)
│   ├── site.ts
│   ├── stats.ts
│   ├── api-error.ts                ← apiError(): پاسخ خطای استاندارد (بدون نشت جزئیات)
│   ├── orders/owner.ts             ← getDeviceHash() + UUID_RE (مالکیت سفارش با کوکی دستگاه)
│   ├── utils/hash.ts               ← ✅ hashData(): هش با Salt + نرمال‌سازی فارسی
│   ├── push/send-push.ts           ← ✅ ارسال پوش با web-push
│   ├── payment/zarinpal.ts         ← توابع ارتباط با زرین‌پال
│   ├── use-order-notifications.ts  ← Polling از API امن
│   ├── use-pwa-badge.ts            
│   ├── use-document-title.ts
│   └── supabase/
├── public/
│   ├── sw.js                       ← ✅ Service Worker (کش + دریافت پوش)
│   └── icons/
├── supabase/
│   └── cron-cleanup.sql            ← SQL راه‌اندازی pg_cron
├── proxy.ts                        ← محافظت سرور-side از /admin
├── dev.bat                         ← منوی توسعه (با Build قبل از Push)
├── (بقیه فایل‌ها بدون تغییر)
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
| **رنگ تخفیف / موفقیت** | `#2d5d3e` / `#477052` | متن تخفیف‌ها (سبز)، بنر سبز باشگاه |
| **رنگ کوپن غیرفعال / لغو / خطا** | `#9b3c32` | هشدارها، بج‌های منفی، لغو، دکمه «عدم تأیید رسید» |
| **رنگ اعلان** | `#dc2626` / `#ef4444` (dark) | Badge و Alert سفارش جدید |
| **رنگ در انتظار (پرداخت)** | `#9a6b3f` | بج‌های در انتظار تأیید |

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

### کلاس‌های کلیدی (به‌روزرسانی‌شده):

**پنل ادمین:** `.admin-shell` / `.admin-sidebar` / `.admin-main` / `.admin-mobile-nav` / `.admin-header` / `.admin-card` / `.btn` / `.field` / `.info-card` / `.info-row`

**کارت‌های سفارش:** `.orders-grid` / `.order-card` / `.order-header` / `.order-body` / `.order-actions` / `.btn-approve` / `.btn-cancel`

**مودال‌ها:** `.modal-overlay` / `.modal-container` / `.modal-body` / `.modal-footer` / `.product-modal-overlay` / `.product-modal-image`

**منوی مشتری:** `.theme-root` / `.hero` / `.sticky-head` / `.toolbar` / `.cats` / `.grid` / `.product` / `.cart-floating-bar` / `.cart-floating-btn` / `.cart-floating-count` / `.cart-floating-text` / `.cart-floating-price`

**سبد و ثبت سفارش:** `.cart-page` / `.cart-item` / `.qty-selector` / `.cart-table-badge` / `.checkout-page` / `.checkout-card` / `.checkout-field` / `.checkout-btn`

**صفحه جزئیات سفارش:** `.order-detail-container` / `.status-stepper` / `.step-item` / `.info-card` / `.sticky-action-bar` / `.btn-whatsapp` / `.order-cancel-section` / `.order-success-banner` / `.order-success-icon` / `.order-success-body` / `.order-success-title` / `.order-success-text` / `.order-success-hint` / `.order-success-close`

**کوپن:** `.coupons-grid` / `.coupon-card` / `.coupon-code` / `.coupon-badge` / `.coupon-input-row` / `.coupon-applied` / `.coupon-selector` / `.coupon-option` / `.coupon-toggle-card` / `.item-badge.badge-eligible` / `.item-badge.badge-ineligible`

**داشبورد:** `.chart-card` / `.chart-bars` / `.chart-col` / `.chart-bar` / `.top-products-list` / `.top-product-item` / `.cleanup-card` / `.comparison-grid` / `.comparison-card` / `.peak-hours`

**دارک مود:** `.admin-shell.dark-mode` + تمام کلاس‌های override شده

**اعلان سفارش:** `.admin-nav-badge` / `.admin-mobile-badge` / `.new-order-alert-container` / `.new-order-alert` / `.new-order-alert-view` / `.new-order-alert-close`

**گزارش کوپن:** `.coupon-report-summary` / `.coupon-report-stat` / `.coupon-report-table` / `.coupon-report-table-header` / `.coupon-report-search` / `.coupon-report-row-clickable` / `.coupon-chart` / `.coupon-chart-row` / `.coupon-chart-bar` / `.coupon-orders-list` / `.coupon-order-item` / `.coupon-order-items` / `.coupon-order-actions`

**دلایل لغو:** `.reasons-grid` / `.reason-card` / `.reason-icon` / `.reason-target` / `.reason-status` / `.reason-card-actions`

**مودال لغو:** `.cancel-reasons-list` / `.cancel-reason-item` / `.cancel-reason-icon` / `.cancel-reason-label` / `.cancel-reason-check` / `.cancel-note-field` / `.cancel-warning`

**آمار لغوها:** `.cancellation-summary-grid` / `.cancellation-summary-card` / `.cancellation-summary-icon` / `.cancellation-reasons-chart` / `.cancellation-chart-row` / `.cancellation-chart-bar` / `.cancellation-table` / `.cancellation-reason-badge` / `.cancellation-by.by-customer` / `.cancellation-by.by-admin` / `.cancellation-row-clickable`

**آمار پیشرفته لغو:** `.cancel-wide-chart` / `.cancel-peak-bar` / `.cancel-chart-hint`

**کارت‌های گزارش:** `.report-cards-grid` / `.report-card` / `.report-card-icon` / `.report-card-body` / `.report-card-title` / `.report-card-value` / `.report-card-hint` / `.report-card-arrow`

**مشتریان (CRM):** `.customers-summary-grid` / `.customers-summary-card` / `.customers-grid` / `.customer-card` / `.customer-avatar` / `.customer-badge` / `.customer-action-btn` / `.preset-tag-btn` / `.custom-tag` / `.customer-notes-input`

**پاکسازی خودکار:** `.cleanup-wrapper` / `.auto-cleanup-card` / `.auto-icon` / `.auto-status-badge` / `.auto-toggle-row` / `.auto-switch` / `.auto-switch-track` / `.auto-switch-thumb` / `.auto-days-row` / `.auto-last-run` / `.auto-last-run-title` / `.auto-last-run-row` / `.auto-last-run-message` / `.auto-last-run-empty`

**گزارش فروش:** `.report-export-actions` / `.sales-summary-grid` / `.sales-summary-card` / `.sales-summary-icon` / `.sales-summary-content` / `.sales-summary-value` / `.sales-summary-label` / `.sales-view-tabs` / `.sales-view-tab` / `.sales-table-wrapper` / `.sales-table` / `.sales-table-num` / `.sales-table-amount` / `.sales-table-discount` / `.sales-table-rank` / `.sales-table-percent` / `.sales-bar-mini` / `.sales-bar-mini-fill` / `.sales-cat-icon` / `.sales-report-hint`

**فیلتر لغو CRM:** `.customers-cancel-filters` / `.customers-cancel-label` / `.customers-cancel-chips` / `.filter-chip.cancel-chip` / `.chip-count` / `.customers-filter-result` / `.customer-card-highlight` / `.cancelled-emphasis`

**هدر و Drawer موبایل:** `.admin-mobile-header` / `.admin-mobile-menu-btn` / `.admin-mobile-logo` / `.admin-mobile-header-badge` / `.admin-drawer-overlay` / `.admin-drawer` / `.admin-drawer-header` / `.admin-drawer-nav` / `.admin-drawer-item` / `.admin-drawer-icon` / `.admin-drawer-label` / `.admin-drawer-badge` / `.admin-drawer-footer` / `.admin-drawer-logout` / `.admin-drawer-close`

**پنل مشتری:** `.my-orders-page` / `.my-orders-header` / `.my-orders-back` / `.my-orders-logout` / `.my-orders-user` / `.my-orders-user-icon` / `.my-orders-filters` / `.my-orders-list` / `.my-orders-empty` / `.my-order-card` / `.my-order-header` / `.my-order-num` / `.my-order-status` / `.my-order-date` / `.my-order-items` / `.my-order-item` / `.my-order-item-more` / `.my-order-total` / `.my-order-cancel-reason` / `.my-order-actions` / `.my-order-btn` / `.customer-login-card` / `.customer-login-icon` / `.customer-login-hint` / `.customer-login-field` / `.customer-login-btn` / `.customer-login-link` / `.customer-login-error` / `.customer-login-code-display` / `.hero-my-orders-btn`

> کلاس‌های باشگاه مشتریان (فرم ثبت‌نام، داشبورد، بنر سبز، پنل ادمین باشگاه) و کارت Push (`EnablePushCard`، بخش ۹۳ CSS) در این فایل فهرست نشده‌اند؛ برای فهرست دقیق، `globals.css` را جستجو کن.

**تنظیمات پرداخت:** `.payment-settings-page` / `.payment-section` / `.payment-section-header` / `.payment-section-icon` / `.payment-section-title` / `.payment-section-hint` / `.payment-warning` / `.payment-sandbox-warning` / `.payment
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
| 40 | PRODUCT DETAIL MODAL + CART BAR + BADGES |
| 41 | CART PAGE (+ cart-table-badge) |
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
| 72 | AUTO CLEANUP (پاکسازی خودکار Cron) |
| 73 | SALES REPORTS (گزارش فروش و مالیات) |
| 74 | CUSTOMERS CANCEL FILTER (فیلتر لغو در CRM) |
| 75 | ADMIN MOBILE THEME TOGGLE (دکمه شناور حالت شبانه) |
| 76 | ADMIN MOBILE HEADER + DRAWER (هدر موبایل + drawer سه‌خطی) |
| 77 | CUSTOMER PANEL (پنل مشتری) |
| 78 | PAYMENT SETTINGS (تنظیمات پرداخت در ادمین) |
| 79 | PAYMENT (انتخاب روش پرداخت + بازگشت از درگاه) |
| 80 | ORDER PAYMENT (بخش پرداخت در صفحه سفارش + چیدمان ستونی دکمه‌های تغییر روش) |
| 82 | RECEIPT UPLOAD (آپلود رسید + دکمه تغییر) |
| 83 | ADMIN ORDER PAYMENT COLORS (رنگ‌بندی کارت‌های ادمین) |
| 84 | ADMIN ORDERS SEARCH (نوار جستجوی سفارش‌ها) |
| 85 | ORDERS TABS (تب‌های سفارش‌ها) |
| 85b | STAT TABS (تب‌های آماری - مشترک صفحات ادمین) |
| 86 | DELIVER WITHOUT PAYMENT (تحویل بدون تسویه) |
| 87 | ORDER SUCCESS BANNER (بنر موفقیت سفارش) |
| 88 | ORDERS SEARCH SELECT (منوی کشویی جستجو) |
| 89 | ORDERS GRID - RESPONSIVE DESKTOP |
| 90 | ADMIN ORDER DELETE BUTTON |
| 91 | CATEGORIES GRID (صفحه اصلی - نسخه categories-grid) |
| 91b | CATEGORIES GRID - cat-grid (نسخه cat-card) |
| 92 | CATEGORY PAGE HEADER (هدر صفحه دسته) |
| 93 | ENABLE PUSH CARD (کارت فعال‌سازی اعلان مرورگر) |
| 94 | MOBILE COMPACT HOMEPAGE (بهینه‌سازی موبایل: حذف بک‌گراند، هدر کوچک، گرید ۳ ستونه) |

---

## ✅ ۴. کارهای انجام‌شده

### 🎓 باشگاه مشتریان سازمانی (B2B Loyalty)
- [x] **دیتابیس:** جداول `organizations`، `organization_members` (با هش)، `redemption_logs`، `membership_requests`.
- [x] **آپلود اکسل:** با تطبیق ستون‌ها (Column Mapping) و ویرایش تک‌تک سلول‌ها قبل از ثبت (پردازش سمت کلاینت با `xlsx`).
- [x] **مدیریت سازمان:** مشاهده لیست اعضا، ویرایش تنظیمات (تخفیف، سقف، تاریخ با تقویم شمسی)، حذف کامل.
- [x] **ثبت‌نام مشتری:** دراپ‌داون انتخاب سازمان، فیلد مشروط شماره دانشجویی، نمایش قوانین پویا.
- [x] **هش امن:** `SHA-256` + Salt + نرمال‌سازی فارسی (`hashData` در `lib/utils/hash.ts`) برای تطبیق دقیق.
- [x] **پنل ادمین باشگاه:** ویرایش قوانین، تأیید/رد درخواست‌های دستی، مشاهده اعضای عادی و سازمانی.
- [x] **اعمال تخفیف در Checkout:** کسر خودکار، نمایش آیتم‌های شامل/غیرشامل، خط‌خوردن مبلغ اولیه، ثبت در `redemption_logs`.
- [x] **داشبورد مشتری:** «خوش اومدی»، آمار (کل سفارش‌ها، مجموع خرید، تخفیف‌ها) و بنر سبز هوشمند برای مشتری عادی/سازمانی.
- [x] **جلوگیری از ثبت‌نام تکراری:** با چک شماره تلفن و شماره دانشجویی.

### 🔔 وب پوش (Web Push Notification)
- [x] پیاده‌سازی با `web-push`، VAPID Keys، Service Worker یکپارچه (`public/sw.js`) و کارت فعال‌سازی (`EnablePushCard`).
- [x] ارسال خودکار در تغییر وضعیت سفارش از پنل ادمین.

### 💳 جریان پرداخت کارت‌به‌کارت (تکمیل‌شده در ۱۴۰۵/۰۸/۰۸)
- [x] **تفکیک وضعیت‌ها:** انتخاب واریز = `payment_method: transfer` + `payment_status: unpaid` (منتظر رسید). فقط `upload-receipt` سفارش را به `pending_review` می‌برد.
- [x] **ثبت سفارش با روش واقعی:** `checkout` فیلد `payment_method` را همراه سفارش می‌فرستد و `orders/route.ts` آن را (از فهرست مجاز `cash/card/transfer/online`، پیش‌فرض `cash`) ثبت می‌کند. دیگر سفارش واریز لحظه‌ای «نقدی» دیده نمی‌شود.
- [x] **قفل سمت سرور رسید:** `upload-receipt` فقط وقتی می‌نویسد که روش `transfer` باشد، هنوز رسیدی (`payment_receipt_url` و `payment_note` هر دو null) ثبت نشده باشد و وضعیت `unpaid/failed/pending_review` باشد.
- [x] **اکشن `rejectReceipt` در `app/admin/orders/actions.ts`:** وضعیت را به `unpaid` برمی‌گرداند و `payment_receipt_url` و `payment_note` را پاک می‌کند (فقط برای `transfer` + `pending_review`).
- [x] **دکمه «❌ عدم تأیید رسید» در `OrdersManager.tsx`** (با confirm قبل از اجرا). بعد از رد، مشتری ظرف ۵ ثانیه فرم رسید و «تغییر روش پرداخت» را دوباره می‌بیند.
- [x] **فیلتر اعلان ادمین (`admin/orders/pending`):** سفارش واریز فقط وقتی اعلان می‌دهد که عکس یا متن رسید داشته باشد.
- [x] **هماهنگی نام فیلد یادداشت رسید:** API هر دو `receiptNote` و `note` را می‌خواند.
- [x] **تست انجام‌شده:** ارسال رسید متنی و تصویری → قفل → رد ادمین → بازشدن مجدد کنترل‌ها.
- [x] **رفع ظاهر دکمه‌های «تغییر روش پرداخت»:** CSS ستونی/تمام‌عرض.

### 🔒 امنیت
- [x] **قفل کردن کامل RLS روی جداول حساس:** `orders`, `coupons`, `customers`, `cancellation_reasons`, `settings`. (حذف Policyهای عمومی) — ⚠️ جداول جدید باشگاه باید جداگانه تأیید شوند (بخش ۵).
- [x] **انتقال همه APIها به `SERVICE_ROLE_KEY`:** ثبت سفارش، پرداخت، لغو، CRM، آپلود رسید و دریافت تنظیمات.
- [x] **جایگزینی OTP با «کوکی دستگاه»:** مشتری بدون کد، فقط با کوکی امن `cafe_device_token` (`httpOnly`) سفارش‌های دستگاه خودش را می‌بیند.
- [x] **حذف جدول `customer_sessions` و فایل‌های OTP.**
- [x] **خصوصی کردن Storage `receipts`:** استفاده از Signed URL.
- [x] **ذخیره `payment_merchant_id` در دیتابیس** با RLS امن و تنظیم از پنل ادمین.
- [x] **آپدیت `dev.bat`:** بیلد اجباری قبل از پوش.
- [x] **مالکیت سفارش با هش دستگاه (`device_id_hash`):** در ثبت سفارش و `payment/upload-receipt` اعمال شده (از `lib/orders/owner.ts`). برای بقیه مسیرهای مشتری به بخش ۵ مراجعه شود.

### 🎨 بهینه‌سازی UI و UX
- [x] **ادغام پرداخت حضوری:** «نقدی» و «کارت‌خوان» در UI یک گزینه «پرداخت در محل».
- [x] **بهینه‌سازی موبایل صفحه اصلی:** حذف بک‌گراند در موبایل، هدر کوچک‌تر، گرید دسته‌ها ۳ ستونه.

### منوی مشتری
- [x] صفحه اصلی با هدر داینامیک + JSON-LD
- [x] جستجوی فارسی + فیلتر «پیشنهاد کافه» + فیلتر دسته‌بندی
- [x] شیت «کل منو» + کارت محصول + مودال جزئیات
- [x] ارسال به سبد + نوار شناور + صفحه سبد + صفحه ثبت سفارش
- [x] صفحه جزئیات سفارش با استپر وضعیت + polling
- [x] **لغو سفارش توسط مشتری** با شمارش معکوس + **انتخاب دلیل**
- [x] **کد تخفیف (کوپن)** با تشخیص اقلام واجد/غیرواجد
- [x] ارسال سفارش به واتساپ
- [x] **پنل مشتری (بدون کد):** تاریخچه سفارش‌ها با کوکی دستگاه + سفارش مجدد
- [x] **دکمه «سفارش‌های من» در هدر منو**
- [x] **انتخاب روش پرداخت در Checkout** (آنلاین، پرداخت در محل، واریز)
- [x] **اجباری شدن شماره میز در Checkout**
- [x] **صفحه بازگشت از درگاه** (`/payment/callback`)
- [x] **آپلود رسید (عکس/متن)** برای پرداخت واریزی
- [x] **بخش پرداخت در صفحه سفارش**
- [x] **بنر موفقیت بعد از ثبت سفارش** (با `sessionStorage`)
- [x] **شماره میز خودکار از لینک QR:** `/?table=N` در `sessionStorage` ذخیره، در Cart با بج نمایش و در Checkout با «✅ از QR تشخیص داده شد» پر می‌شود.
- [x] **نوار شناور سبد خرید (sticky):** در تمام صفحات منو.

### پنل ادمین
- [x] Layout با سایدبار + هدر موبایل + drawer کشویی
- [x] لاگین + محافظت سرور-side + متادیتای `noindex`
- [x] **داشبورد با آمار پیشرفته**
- [x] **پاکسازی خودکار سفارش‌های قدیمی** با pg_cron
- [x] **گزارش فروش و مالیات** (۳ تب + ۶ فیلتر + خروجی CSV)
- [x] **مدیریت سفارش‌ها** + Realtime + فاکتور چاپی
- [x] **مدیریت سفارش‌ها: جستجو، فیلتر، رنگ‌بندی، تسویه سریع و مودال تسویه**
- [x] **مدیریت سفارش‌ها: نمایش رسید واریز + رد رسید**
- [x] **مدیریت محصولات، دسته‌ها، میزها، تم‌ها، جملات**
- [x] **مدیریت کدهای تخفیف** + گزارش پیشرفته
- [x] **خروجی Excel/CSV**
- [x] **CRM (مشتریان)** + فیلتر تعداد لغو
- [x] **مدیریت دلایل لغو** + آمار و گزارش لغوها
- [x] **تنظیمات کامل** + دارک مود
- [x] **اعلان سفارش جدید** (Polling + Badge + صدا)
- [x] **تایتل داینامیک + favicon**
- [x] **PWA Badge**
- [x] **تنظیمات پرداخت** (فعال/غیرفعال، Merchant ID، Sandbox، حساب بانکی)
- [x] **تحویل بدون تسویه:** در مودال تسویه ادمین.
- [x] **حذف نرم سفارش:** APIهای `soft-delete` و `restore`.

### زیرساخت و ابزارها
- [x] سیستم تم داینامیک + Supabase Server/Browser Client + Cart Context
- [x] بکاپ لوکال/سرور + بکاپ خودکار + `dev.bat` + `end-of-day.bat`
- [x] PWA کامل + SEO کامل
- [x] امنیت: `poweredByHeader: false` + `proxy.ts` + `noindex`
- [x] Deploy روی Vercel
- [x] pg_cron
- [x] Storage Bucket (`receipts` - Private)
- [x] درگاه زرین‌پال
- [x] کوپن: تریگر آزادسازی ظرفیت هنگام لغو سفارش (تست‌شده با لغو سفارش نقدی توسط مدیر)

### 🛡️ سخت‌سازی دیتابیس و هش (۱۴۰۵/۰۸/۰۹)
- [x] RLS روی هر ۱۷ جدول `public` روشن است. `is_admin()` مدیر را با UUID ثابت تطبیق می‌دهد. ثبت‌نام Supabase خاموش است.
- [x] مجوزهای `TRUNCATE`، `TRIGGER` و `REFERENCES` از `anon` و `authenticated` گرفته شد. نوشتن `anon` حذف شد. خواندن عمومی فقط برای ۷ جدول منو باز است.
- [x] هش به HMAC-SHA256 تغییر کرد (`lib/utils/hash.ts`). `HASH_SALT` اجباری و حداقل ۳۲ نویسه است. commit `d511fb3` در شاخهٔ `harden-hash-salt`.
- ⚠️ ادغام PR این شاخه و تأیید Preview تأیید نشده است. salt ذخیره‌شده را دوباره تولید نکنید.

### 💰 دفتر پرداخت (`order_payments`)
- [x] جدول `order_payments`، توابع اتمیک و انتقال داده اجرا شد. پرداخت جزئی در پنل ادمین کار می‌کند.
- [x] `rejectReceipt` وضعیت را از دفتر پرداخت تعیین می‌کند (`c046ba8`). تأیید دستی سفارش لغوشده پنهان است.
- [x] تب «پرداخت‌نشده» سفارش‌های `unpaid`، `failed`، `partial` و `pending_review` را نشان می‌دهد؛ لغوشده مستثناست (`18df50e`).
- [ ] رد رسید برای سفارشی که قبلاً پرداخت تأییدشده داشته، هنوز تست نشده.

### 🏅 قواعد اعتبار پرداخت حضوری (۱۴۰۵/۰۸/۰۹–۱۰، merge شد)
- [x] جداول `club_settings` (یک ردیف) و `club_settings_log` (لاگ با `changed_by`).
- [x] مقادیر پایه: `min_settled_orders_for_credit=2`، `allow_credit_for_new_members=false`، `block_members_with_debt=true`، `max_open_debt=500000`، `min_partial_payment=10000`.
- [x] ستون‌های `customers.phone_verified_at` و `customers.credit_override` (`default` / `allow` / `block`). ایندکس یکتای `customers_phone_key`.
- [x] `lib/club/settings.ts` و `lib/club/credit.ts` (`getCustomerCreditState`، `creditDenyMessage`). سفارش تسویه‌شده یعنی `delivered` و `paid`.
- [x] در `app/api/orders/route.ts` پرداخت `cash` یا `card` پیش از تخفیف باشگاه اعتبارسنجی می‌شود. `transfer` و `online` محدود نیستند.
- [x] پنل مشتریان اعتبار و بدهی را نشان می‌دهد. `customers/update` با `requireAdmin()` محافظت شد.
- [x] صفحهٔ `/admin/settings/club` با لاگ تغییرات (`assertAdminId()` برای `changed_by`).
- ℹ️ `memberships` فقط برای سازمان‌های B2B است و با قواعد اعتبار ادغام نمی‌شود.

### 🧾 ثبت سفارش حضوری (شروع‌شده، ۱۴۰۵/۰۸/۱۰)
- [x] API جدید `app/api/admin/orders/create/route.ts` با `requireAdminUser`؛ دو حالت (بی‌نام / با نام و میز) تست شد.
- [x] قیمت‌گذاری سروری، بدون قفل دستگاه، قانون اعتبار، تخفیف باشگاه و کوپن.
- [x] ثبت با `status='confirmed'`، `payment_method='cash'`، `payment_status='unpaid'`، `source='admin'`.
- [x] مشتری بی‌نام: نام «مهمان» و `customer_phone=''` (ستون NOT NULL است). CRM آن را رد می‌کند.
- [ ] ⚠️ این فایل هنوز commit نشده است.
- [ ] صفحهٔ `/admin/orders/new` و تسویهٔ حضوری ساخته نشده‌اند.

### رفع باگ‌ها
- [x] رفع باگ‌های مربوط به به‌هم‌ریختگی صفحات
- [x] رفع مشکل Service Worker در dev
- [x] جایگزینی Realtime با Polling
- [x] جایگزینی `middleware.ts` با `proxy.ts`
- [x] رفع خطای `Expression expected` در `stats.ts`
- [x] رفع خطای `Cannot read properties of undefined`
- [x] رفع خطای TS در `categories/page.tsx` و `proxy.ts`
- [x] رفع نبود دکمه حالت شبانه روی موبایل
- [x] رفع خطای نمایش سفارش‌ها (چندفرمتی)
- [x] رفع خطای عدم دسترسی به سفارش در `payment/verify`
- [x] رفع مشکل اعتبارسنجی شماره
- [x] رفع خطای `updated_at` در جدول `customers`
- [x] رفع خطای `column settings.payment_merchant_id does not exist`
- [x] رفع باگ نمایش صفر در داشبورد، آمار لغوها و گزارش فروش (stats.ts → Service Role)
- [x] **رفع باگ آپلود رسید (فاز ۱):** انتقال API به `supabaseAdmin`، مدیریت خطای JSON سرور، کاهش محدودیت حجم به ۳MB و نمایش مجدد عکس.
- [x] **افزودن دکمه «تحویل بدون تسویه»** به مودال تسویه.
- [x] **رفع باگ گزارش کوپن‌ها:** مودال سفارش‌های کوپن به `supabaseAdmin` منتقل شد.
- [x] **رفع باگ دراور ادمین:** قفل اسکرول پس‌زمینه و هدر موبایل `position: fixed`.
- [x] **یکدست‌سازی تب‌های ادمین:** کلاس‌های `stat-tabs`.
- [x] **رفع باگ قطع ارتباط داشبورد با دیتابیس:** `lib/stats.ts` به `SUPABASE_SERVICE_ROLE_KEY` و `server-only` منتقل شد.
- [x] **رفع باگ نمایش تکراری تاریخ ثبت سفارش** در ریز اقلام.
- [x] **افزودن نمایش رسید قبلی در `UploadReceipt`** (پراپ `initialUrl`).
- [x] **افزودن دکمه «🔄 تغییر رسید».**
- [x] **رفع خطای TypeScript `Duplicate identifier` در `menu-types.ts`.**
- [x] **رفع خطای بیلد CSS (Missing Braces).**
- [x] **رفع باگ ۳ فیلد تکراری در Checkout.**
- [x] **پاکسازی `globals.css` از ۹ مشکل ساختاری.**
- [x] **رفع خطاهای Build نهایی:** `✓ Compiled successfully` روی Next.js 16.3.8.
- [x] **رفع خطای build در `payment/set-method`:** `Cannot find name 'updates'`.
- [x] **رفع ظهور زودهنگام سفارش واریز در پنل ادمین** (دو علت: `pending_review` زودهنگام + ثبت اولیه با `cash`).
- [x] **رفع نبود دکمه رد رسید در ادمین.**
- [x] **رفع باگ فیلتر اعلان:** سفارش دارای فقط «متن رسید» اعلان نمی‌داد.
- [x] **رفع ظاهر خراب دکمه‌های «تغییر روش پرداخت».**

---

## 🚧 ۵. کارهای باقی‌مانده

> اولویت‌ها: 🔴 بالا / 🟠 متوسط / 🟡 سخت‌سازی / 🟢 پایین

### 🔴 اولویت بالا (امنیت داده و پول)
- [ ] 🔴 ادغام شاخهٔ `harden-hash-salt` و اطمینان از تنظیم `HASH_SALT` (حداقل ۳۲ نویسه) در Vercel و `.env.local`. وضعیت نامعلوم است.
- [ ] 🔴 بازبارگذاری لیست اعضای باشگاه اگر salt عوض شده باشد.
- [ ] 🔴 RPC اتمیک برای ثبت سفارش + لاگ مصرف + بررسی سقف، با `unique(order_id)` در `redemption_logs`.
- [ ] 🔴 برگشت سهمیه هنگام لغو سفارش.
- [ ] 🔴 محاسبهٔ تخفیف باشگاه فقط سروری.
- [ ] 🔴 مالکیت سفارش در `GET /api/orders/[id]`، `orders/cancel`، `customer-confirm`، `set-method` + تست `404`.
- [ ] 🔴 حذف تابع `reset_test_data(boolean, boolean, boolean)`.
- [ ] 🔴 فعال‌کردن Leaked Password Protection.
- [ ] 🔴 بررسی دسترسی `cancel_order_by_customer` و تست `cleanup/status`.
- [ ] 🔴 تست Actionهای ادمین بعد از logout.
- [ ] 🔴 تست کامل روی موبایل واقعی + جریان سفارش با همهٔ روش‌های پرداخت + `npm run build` نهایی.
- [ ] 🔴 تأیید شمارهٔ مشتریان واقعی در `/admin/customers` (تا آن زمان پرداخت نقدی/کارت‌خوان برایشان بسته است).
- [ ] 🟠 ادامهٔ سفارش حضوری: صفحهٔ `/admin/orders/new` + CSS + تسویهٔ کامل/جزئی + لینک منو.
- [ ] 🟠 حذف رسید از Storage پس از رد + Rate Limiting برای `upload-receipt` و `payment/request`.
- [ ] 🟡 `npm audit` برای `xlsx`؛ از `npm audit fix --force` استفاده نشود.
- [ ] 🟢 آینده: OTP، فاکتور و لینک پرداخت، پرداخت بخشی/دنگی، لینک اشتراکی، گزارش مالی و CSV، قواعد تخفیف و لغو.

### 🟠 اولویت متوسط (درستی منطق)
- [ ] 🟠 **ترکیب تخفیف باشگاه و کوپن (تصمیم ۹۳):** تخفیف باشگاه اولویت دارد و هم‌زمان با کوپن اعمال نمی‌شود. باید پیاده‌سازی و تست شود: وقتی تخفیف باشگاه اعمال می‌شود، ظرفیت کوپن مصرف نشود (یا با `release_coupon` برگردد) و UI کوپن را «غیرفعال» نشان دهد، نه اینکه بی‌صدا حذف شود.
- [ ] 🟠 **`max_total_orders`:** فرض پیشنهادی: سقف کل هم برای هر عضو است (مثل سقف روزانه) و در فرم ساخت/ویرایش سازمان انتخاب می‌شود. تأیید شود و در UI ادمین و متن قوانین ثبت‌نام همین عبارت نوشته شود.
- [ ] 🟠 **فرم ساخت و ویرایش سازمان:** فیلد «سقف سفارش روزانه برای هر عضو» (عدد یا «بدون محدودیت») هم در فرم ایجاد و هم در ویرایش باشد. مقدارش در RPC خوانده شود، نه ثابت در کد.
- [ ] 🟠 **تاریخ انقضا:** تاریخ شمسی به «پایان همان روز به وقت تهران» تبدیل شود.
- [ ] 🟠 **حریم خصوصی `membership_requests`:** نام، تلفن و شماره عضویت بدون هش‌اند؛ زمان نگهداری تعریف شود (حذف پس از تأیید/رد یا بعد از ۳۰ روز).
- [ ] 🟠 **پیام‌های ثبت‌نام یکسان** (جلوگیری از لو رفتن عضویت افراد با «قبلاً ثبت شده») + **Rate Limiting** روی `membership/register` و `membership/calculate`.
- [ ] 🟠 **مسیر «انتقال دستگاه» برای عضو:** با پاک‌شدن کوکی یا عوض‌شدن گوشی، عضویت از دست می‌رود؛ بازیابی با شماره عضویت + تلفن و ثبت در لاگ.
- [ ] 🟠 **اتصال ثبت‌نام باشگاه به CRM:** ثبت خودکار در `customers` با تگ مربوط.
- [ ] 🟠 **پاک‌سازی سفارش‌های قدیمی واریز:** اجرای SQL زیر (اگر اجرا نشده):
  ```sql
  update public.orders
  set payment_status = 'unpaid'
  where payment_method = 'transfer'
    and payment_status = 'pending_review'
    and payment_receipt_url is null
    and payment_note is null;
  ```
- [ ] 🟠 **تغییر روش از واریز به نقدی بعد از ثبت رسید:** `payment_receipt_url` و `payment_note` باید پاک شوند.
- [ ] 🟠 **تریگر SQL پاک‌کردن رسید** هنگام `pending_review → unpaid/failed`: نصب و تست نهایی نشده (فعلاً `rejectReceipt` خودش رسید را پاک می‌کند).
- [ ] 🟠 **قفل لغو مشتری:** لغو فقط وقتی رسیدی ارسال نشده و پرداخت نشده مجاز باشد (ملاک: وجود رسید، نه `pending_review`).
- [ ] 🟠 **فهرست اصلی `OrdersManager`:** سفارش واریز بدون رسید نمایش داده نشود یا برچسب «منتظر رسید» بگیرد.
- [ ] 🟠 **کوپن:** تست استفاده مجدد با همان تلفن/دستگاه، لغو سفارش کارت‌به‌کارت و برگشت ظرفیت، و دو درخواست هم‌زمان.
- [ ] 🟠 **تصمیم کوپن:** محدودیت «یک‌بار برای هر مشتری» برای همه کوپن‌هاست یا فقط `max_uses === 1`؟
- [ ] 🟠 **نصب توابع کوپن:** `consume_coupon` و `release_coupon` باید واقعاً نصب باشند؛ کد کوپن uppercase شود.
- [ ] 🟠 **زرین‌پال:** تست کامل sandbox و callback تکراری.
- [ ] 🟡 **تست آپلود رسید با گوشی واقعی** (متن و تصویر در تست دسکتاپ/مرورگر موفق بود).

### 🟡 سخت‌سازی و نگهداری
| حوزه | کار |
|---|---|
| وابستگی `xlsx` | نسخه npm در `0.18.5` مانده (CVE-2023-30533، prototype pollution)؛ نسخه رسمی از CDN خود SheetJS نصب شود یا مهاجرت به `exceljs`؛ محدودیت حجم فایل و تعداد ردیف اضافه شود |
| ورودی‌ها | اعتبارسنجی JSON در `variant_groups` و `cancellation-reasons`؛ محدودیت حجم و نوع فایل برای تصویر محصول و فونت |
| Rate Limiting | ورود ادمین، کوپن، عضویت، APIهای عمومی و ثبت سفارش |
| رازها | چرخش `HASH_SALT` و `STEPUP_SECRET`؛ بررسی نشت `SUPABASE_SERVICE_ROLE_KEY` و `VAPID_PRIVATE_KEY` |
| هدرها | HSTS و CSP |
| وابستگی‌ها | `npm audit` و بررسی نسخه Next.js |
| بکاپ | تهیه بکاپ و یک بار آزمون بازیابی |
| فایل‌های رسید | فایل‌های رسیدِ ردشده در باکت `receipts` می‌مانند → پاک‌سازی دوره‌ای |
| CSS | دکمه «عدم تأیید رسید» فعلاً استایل inline دارد → به کلاس در `globals.css` منتقل شود (قانون ۳) |

### 🟢 اولویت پایین
- [ ] 🟢 **ایمیل/SMS اطلاع‌رسانی** برای سفارش‌های جدید و تحویل شده / تغییر وضعیت
- [ ] 🟢 **تست بار (Load Test)** روی Supabase
- [ ] 🟢 **آیکون PWA با badge برای مشتری**
- [ ] 🟢 **اتصال به درگاه پرداخت‌های دیگر** (آیدی‌پی، نکست‌پی) — زیرساخت آماده است
- [ ] 🟢 **اتصال به نرم‌افزار حسابداری پارسیان**
- [ ] 🟢 **پنل اختصاصی مشتری (Login / SMS OTP)** برای دسترسی به تاریخچه از هر دستگاهی
- [ ] 🟢 **افزودن جزئیات بیشتر به مودال تسویه**

### 🎯 ترتیب پیشنهادی
1. چرخش `HASH_SALT` + تغییر به HMAC
2. قفل RLS ۴ جدول باشگاه
3. RPC اتمیک ثبت سفارش/لاگ مصرف/سقف + برگشت سهمیه هنگام لغو
4. پیاده‌سازی قانون «تخفیف باشگاه یا کوپن» (تصمیم ۹۳) + سقف روزانه هر عضو (تصمیم ۹۲)
5. بستن مالکیت `orders/[id]`، `cancel` و `customer-confirm`
6. حذف `reset_test_data` + فعال‌کردن Leaked Password Protection
7. Rate Limiting + پیام‌های یکسان ثبت‌نام + هدرهای امنیتی
8. تست کوپن و زرین‌پال، سپس تست کامل روی موبایل
9. بکاپ، `npm audit` و جایگزینی `xlsx`

---

## 🔑 ۶. قوانین طلایی کدنویسی

1. 🚨 **هر کلاس جدید در JSX باید حتماً در `globals.css` تعریف شود.**
2. **نام کلاس‌ها با BEM-like:** `block-element` یا `block-element-modifier`
3. **هیچ استایل inline نداشته باشیم**، مگر برای مقادیر داینامیک.
4. **همه چیز از پالت رنگ بخش ۳ استفاده کند.**
5. **روی موبایل تست شود** — breakpoint‌ها: `650px`, `768px`, `640px`, `500px`
6. **برای همه مودال‌ها از `modal-overlay` + `modal-container` استفاده شود.**
7. **قبل از ارسال به چت جدید، فایل `PROJECT_STATE.md` را پیوست کن.**
8. **بعد از هر تغییر مهم، `Ctrl+Shift+R` رفرش کن.**
9. **متن‌های `.bat` به انگلیسی + ایموجی باشند.**
10. **برای سرور از `SERVICE_ROLE_KEY` استفاده شود، برای کلاینت از `supabaseBrowser()`.** (به دلیل قفل بودن RLS)
11. **در کوئری‌های Supabase، همیشه ستون‌های جدید را به `select` اضافه کن.**
12. **برای اعلان‌ها، از Polling استفاده شود (نه Realtime)** — تحریم ایران.
13. **متن‌های کامنت CSS رو کپی نکن.**
14. **در fetch های API از `cache: 'no-store'` استفاده کن.**
15. **در کوئری سفارش‌های مشتری، با چند فرمت شماره جستجو کن.**
16. **برای عملیات‌های حساس (دیتابیس)، حتماً از API Route یا Server Action با کلید مخفی استفاده کن.**
17. **هر فایل سروری که با SERVICE_ROLE_KEY کار می‌کند، حتماً `import 'server-only'` داشته باشد.**
18. **برای عملیات دیتابیسی در سرور (API ها)، به‌جای ساخت کلاینت جدید، همیشه از تابع `supabaseAdmin()` از فایل `lib/supabase/server.ts` استفاده شود.**
19. **پراپ‌های کامپوننت باید در `type Props` تعریف شوند** — اضافه کردن پراپ جدید بدون تعریف در `Props`، خطای بیلد می‌دهد.
20. **بعد از هر پاکسازی یا جابجایی بلوک‌های CSS، حتماً `npm run build` بزن.**
21. **قانون وضعیت پرداخت واریز:** `unpaid` = روش انتخاب شده و رسیدی نیست؛ `pending_review` = رسید (عکس/متن) ثبت شده و ادمین باید تصمیم بگیرد. **فقط** `payment/upload-receipt` حق دارد `pending_review` بنویسد؛ `set-method` و ثبت سفارش هرگز.
22. **روش پرداخت را همراه ثبت سفارش بفرست** (`payment_method` در body `/api/orders`) تا سفارش در هیچ لحظه‌ای با روش اشتباه دیده نشود.
23. **هر API مشتری باید مالکیت را با `device_id_hash` (`getDeviceHash()`) بررسی کند** و برای سفارش دیگران `404` بدهد.
24. **PowerShell:** برای خواندن فایل‌ها همیشه `Get-Content ... -Encoding UTF8` همراه `[Console]::OutputEncoding = [Text.Encoding]::UTF8` استفاده کن.
25. **برای هش کردن اطلاعات هویتی، فقط از `hashData` در `lib/utils/hash.ts` استفاده شود** (هیچ هش پراکنده‌ای در کد نباشد).
26. **هیچ مقدار واقعی راز (`HASH_SALT`، کلیدها) در فایل‌های مستندات، چت یا Git نوشته نشود.**
27. **سقف‌ها و سهمیه‌ها (باشگاه، کوپن) فقط داخل تابع SQL اتمیک (RPC) شمرده و مصرف شوند** و هر مسیر لغو/شکست باید سهمیه را برگرداند.
28. **سفارش حضوری از مسیر جدا ساخته می‌شود** (`api/admin/orders/create`)، چون قفل دستگاه و تخفیف باشگاه برای پرسنل مناسب نیست.
29. **برای لاگ تغییرات از `assertAdminId()` استفاده شود** (`assertAdmin()` شناسه برنمی‌گرداند).
30. **`next-env.d.ts` و `*.bak` commit نشوند.**
31. **برای هر ویژگی بزرگ شاخهٔ جدا بسازید** و بعد از تست Preview ادغام کنید.
---

## 📝 ۷. متن آماده برای شروع چت جدید

> هر بار که می‌خواهی چت جدید بزنی، این متن را کپی کن و فایل `PROJECT_STATE.md` را ضمیمه کن:

```text
سلام. من روی پروژه «کافه پارک» (Next.js 16 + Supabase + globals.css) کار می‌کنم.
فایل PROJECT_STATE.md وضعیت کامل پروژه، سیستم طراحی، کلاس‌های CSS و کارهای باقی‌مانده را توضیح می‌دهد.
لطفاً قبل از هر کاری، این فایل را کامل بخوان و بر اساس آن ادامه بده.

⚠️ قوانین حیاتی:
1. تمام استایل‌ها فقط در app/globals.css هستند (بدون Tailwind).
2. هر کلاس جدیدی که در JSX استفاده می‌شود، باید در globals.css تعریف شود.
3. پالت رنگ از متغیرهای CSS می‌آید، نه رنگ hex مستقیم.
4. مودال‌ها از کلاس‌های modal-overlay + modal-container استفاده کنند.
5. بخش‌های globals.css شماره‌گذاری شده‌اند (۱ تا ۹۴ با زیرشماره‌ها).
6. برای اعلان‌ها از Polling استفاده شود، نه Realtime (تحریم ایران).
7. محافظت ادمین با proxy.ts (نه middleware.ts در Next.js 16).
8. در fetch های API از cache: 'no-store' استفاده شود.
9. در کوئری سفارش‌های مشتری، با چند فرمت شماره جستجو شود.
10. به دلیل قفل بودن RLS، همه APIهای حساس باید از SERVICE_ROLE_KEY استفاده کنند.
11. هر پراپ جدید کامپوننت باید در `type Props` تعریف شود، وگرنه بیلد fail می‌شود.
12. بعد از هر پاکسازی CSS، `npm run build` بزن تا خطاهای braces گرفته شوند.
13. وضعیت پرداخت واریز: unpaid = منتظر رسید، pending_review = رسید ثبت شده. فقط upload-receipt حق نوشتن pending_review دارد.
14. همه APIهای مشتری باید مالکیت سفارش را با device_id_hash (lib/orders/owner.ts) چک کنند و برای غیرمالک 404 بدهند.
15. تمام هش‌ها فقط با hashData در lib/utils/hash.ts؛ هیچ راز واقعی در فایل/چت نوشته نشود.
16. باشگاه B2B: سقف روزانه برای هر عضو است و تنظیم هر سازمان (قابل انتخاب/ویرایش در پنل)؛ تخفیف باشگاه اولویت دارد و با کوپن ترکیب نمی‌شود؛ سقف‌ها فقط در RPC اتمیک شمرده شوند.


📁 ابزارهای موجود در پروژه:
- dev.bat / end-of-day.bat
- npm run backup / backup:server / backup:clean
- npm run build:icons / transparent
- Web Push (VAPID)
- xlsx (آپلود اکسل)، react-multi-date-picker (تقویم شمسی)
- supabase/cron-cleanup.sql → SQL پاکسازی خودکار

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
| 1405/07/19 | رفع به‌هم‌ریختگی همه صفحات ادمین و منو |
| 1405/07/19 | ایجاد PROJECT_STATE.md + اسکریپت‌های بکاپ |
| 1405/07/19 | افزودن dev.bat + end-of-day.bat |
| 1405/07/19 | رفع باگ بکاپ دوبل + مشکل Git |
| 1405/07/20 | افزودن دکمه چاپ فاکتور + رفع فونت فاکتور |
| 1405/07/20 | افزودن PWA کامل |
| 1405/07/20 | بهبود کامل SEO |
| 1405/07/20 | شفاف‌سازی آیکون‌های PWA |
| 1405/07/20 | افزودن آمار فروش در داشبورد ادمین |
| 1405/07/20 | افزودن لغو سفارش توسط مشتری |
| 1405/07/20 | افزودن پاکسازی سفارش‌های قدیمی |
| 1405/07/21 | افزودن سیستم کامل کد تخفیف (کوپن) |
| 1405/07/21 | افزودن max_order_amount و coupon_eligible |
| 1405/07/21 | نمایش تخفیف در فاکتور چاپی |
| 1405/07/21 | افزودن دارک مود برای پنل ادمین |
| 1405/07/21 | افزودن اعلان سفارش جدید |
| 1405/07/21 | افزودن تایتل و favicon داینامیک |
| 1405/07/21 | جایگزینی Realtime با Polling |
| 1405/07/21 | افزودن proxy.ts + حذف X-Powered-By |
| 1405/07/22 | افزودن گزارش پیشرفته کوپن‌ها |
| 1405/07/22 | استخراج PrintInvoice.tsx |
| 1405/07/22 | افزودن خروجی Excel/CSV از سفارش‌ها |
| 1405/07/22 | افزودن داشبورد پیشرفته |
| 1405/07/22 | افزودن CRM (مشتریان) |
| 1405/07/23 | افزودن سیستم کامل لغو سفارش |
| 1405/07/23 | افزودن مودال جزئیات سفارش لغو شده |
| 1405/07/24 | افزودن آمار پیشرفته لغوها |
| 1405/07/24 | بازطراحی صفحه آمار لغوها |
| 1405/07/24 | رفع خطای Expression expected در stats.ts |
| 1405/07/24 | رفع خطای Cannot read properties of undefined |
| 1405/07/25 | افزودن پاکسازی خودکار با pg_cron |
| 1405/07/26 | افزودن گزارش فروش و مالیات |
| 1405/07/27 | افزودن فیلتر تعداد لغو در CRM |
| 1405/07/28 | بازطراحی ناوبری موبایل ادمین |
| 1405/08/01 | افزودن پنل مشتری (ورود OTP + تاریخچه + سفارش مجدد) |
| 1405/08/01 | **فاز بزرگ باشگاه مشتریان B2B:** جداول جدید، آپلود اکسل، هش امن، فرم ثبت‌نام، پنل مدیریت باشگاه، اعمال تخفیف در Checkout، داشبورد مشتری + بهینه‌سازی UI موبایل صفحه اصلی |
| 1405/08/02 | افزودن PWA Badge |
| 1405/08/02 | پیاده‌سازی کامل سیستم پرداخت چندگانه (زرین‌پال + نقدی + کارت‌خوان + واریز) |
| 1405/08/02 | افزودن تنظیمات پرداخت در پنل ادمین |
| 1405/08/02 | افزودن صفحه بازگشت از درگاه + آپلود رسید |
| 1405/08/02 | افزودن نمایش وضعیت پرداخت (بج + رنگ) در پنل ادمین |
| 1405/08/02 | افزودن مودال تسویه سریع |
| 1405/08/02 | افزودن جستجو و فیلتر «پرداخت نشده» |
| 1405/08/02 | اجباری شدن شماره میز در Checkout |
| 1405/08/02 | رفع باگ‌های مربوط به پرداخت (RLS، نرمال‌سازی شماره، وضعیت) |
| 1405/08/03 | **بهینه‌سازی امنیتی بزرگ:** قفل RLS + انتقال APIها به Service Role + جایگزینی OTP با کوکی دستگاه + انتقال Merchant ID به دیتابیس قفل‌شده + آپدیت dev.bat برای جلوگیری از پوش خراب |
| 1405/08/03 | رفع باگ قطع ارتباط داشبورد/آمار لغوها/گزارش فروش با دیتابیس (انتقال stats.ts به Service Role) |
| 1405/08/03 | **تکمیل فاز ۱ (Quick Wins):** رفع باگ آپلود رسید (E)، دکمه تحویل بدون تسویه (C)، گزارش کوپن (M)، دراور ادمین (H)، تب‌های سفارش (I) و رفع نهایی باگ RLS در `stats.ts`. |
| 1405/08/04 | **آپدیت `PROJECT_STATE.md`:** افزودن بنر موفقیت سفارش، بهبود UX آپلود رسید، رفع باگ نمایش تکراری تاریخ در ریز اقلام، و حذف فیلدهای تکراری `floating_*` در `menu-types.ts`. |
| 1405/08/05 | **فاز Quick Wins ۲:** شماره میز خودکار از QR، نوار شناور sticky سبد خرید، رفع ۳ فیلد تکراری در Checkout، پاکسازی `globals.css` از ۹ مشکل ساختاری، و **Build موفق** روی Next.js 16.3.8. |
| 1405/08/06 | پیاده‌سازی کامل Web Push Notification (VAPID، جدول اشتراک‌ها، Service Worker و کارت فعال‌سازی) |
| 1405/08/07 | ادغام روش‌های پرداخت «نقدی» و «کارت‌خوان» به یک گزینه واحد «پرداخت در محل» در Checkout، صفحه سفارش و پنل ادمین. |
| 1405/08/08 | **تکمیل جریان رسید کارت‌به‌کارت:** مالکیت سفارش با `device_id_hash` (ثبت سفارش + upload-receipt)، قفل سمت سرور رسید، تفکیک `unpaid` از `pending_review`، اکشن `rejectReceipt` + دکمه «❌ عدم تأیید رسید»، ثبت سفارش با `payment_method` واقعی، اصلاح فیلتر اعلان (شامل متن رسید)، هماهنگی `receiptNote`/`note`، رفع خطای build در `set-method`، و اصلاح CSS دکمه‌های تغییر روش پرداخت. تست متن و تصویر رسید → قفل → رد → بازشدن مجدد موفق. |
| 1405/08/08 | **ممیزی باقی‌مانده‌ها:** فهرست اولویت‌دار امنیت/منطق/سخت‌سازی به بخش ۵ اضافه شد. |
| 1405/08/08 | **ادغام مستندات باشگاه B2B در این فایل** + ممیزی باشگاه (چرخش `HASH_SALT`، HMAC، RPC اتمیک، برگشت سهمیه، RLS جداول جدید، پیام‌های یکسان، `xlsx`) + ثبت دو تصمیم: **سقف روزانه برای هر عضو** و **اولویت تخفیف باشگاه بر کوپن (بدون ترکیب)**. |
| 1405/08/09 | سخت‌سازی دیتابیس: RLS روی ۱۷ جدول، `is_admin()`، گرفتن مجوزهای اضافه. هش HMAC-SHA256 (شاخهٔ `harden-hash-salt`) |
| 1405/08/09 | دفتر پرداخت `order_payments`، پرداخت جزئی، اصلاح `rejectReceipt` و تب «پرداخت‌نشده» |
| 1405/08/09 | قواعد اعتبار پرداخت حضوری، تأیید شماره، `credit_override`، محافظت `customers/update` |
| 1405/08/10 | صفحهٔ `/admin/settings/club` با لاگ تغییرات (`e10097f`)؛ `feature-club-rules` ادغام شد |
| 1405/08/10 | API ثبت سفارش حضوری `admin/orders/create` ساخته و تست شد (بدون commit) |

---

## 🔗 ۹. دستورات مهم (Quick Reference)

### اسکریپت‌های npm:
```bash
npm run dev               # اجرای پروژه در حالت توسعه
npm run build             # بیلد گرفتن
npm start                 # اجرای نسخه Build شده
npm run lint              # اجرای Linter
npm run backup            # بکاپ لوکال
npm run backup:clean      # پاکسازی بکاپ‌های قدیمی
npm run backup:schedule   # بکاپ خودکار (هر ۲۴ ساعت)
npm run backup:server     # بکاپ کامل سرور
npm run icons             # ساخت آیکون‌های PWA
npm run transparent       # شفاف‌سازی آیکون‌ها
npm run build:icons       # ساخت همه سایزها
```

### Git:
```bash
git pull origin main --rebase --autostash
git add . && git commit -m "پیام" && git push origin main
```

### PowerShell (خواندن فایل با فارسی سالم):
```powershell
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Get-Content "app\api\orders\route.ts" -Encoding UTF8 | Select-String -Pattern "payment_method" | Select-Object LineNumber, Line
```

### متغیرهای محیطی (`.env.local` و Vercel):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
NEXT_PUBLIC_SITE_URL=https://cafe-park-menu.vercel.app
VAPID_PUBLIC_KEY=BEl62iUYgUivx...
VAPID_PRIVATE_KEY=UUxI4O8-Fb...
VAPID_SUBJECT=mailto:hadiassadi@gmail.com
HASH_SALT=...            # نمک/کلید هش هویت اعضا و device_id (باید چرخانده شود؛ هرگز در کد/چت/مستندات ننویس)
STEPUP_SECRET=...        # راز step-up ادمین (چرخش لازم است)
```

---

## 💾 ۱۰. سیستم بکاپ

| نوع | دستور | مسیر | حجم | شامل | نگهداری |
|---|---|---|---|---|---|
| **لوکال** | `npm run backup` | `backups/` | ~0.7 MB | سورس + .bat | ۳۰ روز |
| **سرور** | `npm run backup:server` | `backups-server/` | ~67 MB | سورس + node_modules + .env.local | ۱۴ روز |

### اسکریپت‌ها:
| اسکریپت | کاربرد |
|---|---|
| `scripts/backup.mjs` | بکاپ لوکال (فایل + zip) |
| `scripts/backup.mjs --clean` | پاکسازی بکاپ‌های قدیمی |
| `scripts/backup-server.mjs` | بکاپ کامل سرور |
| `scripts/schedule-backup.mjs` | اجرای خودکار هر ۲۴ ساعت |
| `scripts/generate-icons.mjs` | ساخت آیکون از رنگ + متن |
| `scripts/make-transparent.mjs` | حذف پس‌زمینه |
| `scripts/build-icons.mjs` | ساخت همه سایزها |

---

## 🗄️ ۱۱. جداول دیتابیس (Supabase)

| جدول | کاربرد | فیلدهای کلیدی |
|---|---|---|
| `categories` | دسته‌بندی محصولات | `id`, `name`, `icon`, `sort_order`, `is_active`, `coupon_eligible` |
| `products` | محصولات | `id`, `category_id`, `name`, `price`, `image_url`, `is_featured`, `is_new`, `is_available`, `size`, `calories`, `prep_time_minutes`, `ingredients`, `allergens`, `dietary_info`, `coupon_eligible` |
| `variant_groups` | گروه‌های تنوع | `id`, `product_id`, `name`, `is_required`, `sort_order` |
| `variant_options` | گزینه‌های هر گروه | `id`, `group_id`, `name`, `price_modifier`, `is_default`, `is_available`, `sort_order` |
| `orders` | سفارش‌ها | `id`, `order_number`, `customer_name`, `customer_phone`, `table_number`, `note`, `items` (JSONB), `subtotal`, `status`, `original_subtotal`, `coupon_code` (برای تخفیف باشگاه مقدار `MEMBERSHIP`)، `coupon_discount`, `eligible_subtotal`, `ineligible_subtotal`, `cancellation_reason_id`, `cancellation_reason_label`, `cancellation_note`, `cancelled_by`, **`payment_method`**, **`payment_status`**, **`payment_authority`**, **`payment_ref_id`**, **`payment_amount`**, **`payment_receipt_url`**, **`payment_verified_at`**, **`payment_note`**, **`device_id_hash`**, `created_at`, `confirmed_at`, `preparing_at`, `ready_at`, `delivered_at`, `cancelled_at` |
| `tables` | میزها | `id`, `number`, `name`, `description`, `capacity`, `location`, `sort_order`, `is_active`, `qr_token` |
| `quotes` | جملات | `id`, `text`, `author`, `is_active` |
| `themes` | تم‌ها | رنگ‌ها + font_url‌ها + `font_metadata` (JSONB), `border_radius`, `is_active` |
| `settings` | تنظیمات سایت (id=1) | `cafe_name`, `tagline`, `hero_*`, `footer_text`, `address`, `phone`, `instagram`, `working_hours`, `logo_url`, `maps_url`, `og_*`, `show_*`, `*_in_header/footer/floating`, `auto_cleanup_enabled`, `auto_cleanup_days`, **`payment_enabled`**, **`payment_online_enabled`**, **`payment_cash_enabled`**, **`payment_card_enabled`**, **`payment_transfer_enabled`**, **`payment_gateway`**, **`payment_merchant_id`**, **`payment_sandbox_mode`**, **`payment_min_online_amount`**, **`payment_transfer_bank_name`**, **`payment_transfer_account_number`**, **`payment_transfer_card_number`**, **`payment_transfer_account_holder`**, **`payment_transfer_requires_review`**, **`payment_transfer_auto_verify`**, **`admin_allow_delete_orders`**, **`membership_rules_general`**, **`membership_rules_org`** |
| `coupons` | کدهای تخفیف | `id`, `code`, `description`, `discount_type`, `discount_value`, `min_order_amount`, `max_order_amount`, `max_discount`, `max_uses`, `used_count`, `valid_from`, `valid_until`, `is_active` |
| `customers` | مشتریان (CRM) | `phone`, `name`, `notes`, `tags`, `device_id_hash`, `updated_at` |
| `cancellation_reasons` | دلایل لغو | `id`, `label`, `target`, `icon`, `sort_order`, `is_active` |
| `push_subscriptions` | اشتراک‌های اعلان مرورگر | `id`, `device_id_hash`, `endpoint`, `p256dh`, `auth`, `user_agent`, `is_active`, `created_at`, `last_used_at` |
| **`organizations`** | تنظیمات کلی سازمان‌ها (باشگاه B2B) | `id`, `name`, `discount_percent`, `max_daily_orders` (**سقف روزانه برای هر عضو**)، `max_total_orders` (⚠️ تعریف نهایی باقی است)، `expires_at`, `is_active` |
| **`organization_members`** | اعضای تأیید‌شده سازمان‌ها | `id`, `organization_id`, `full_name_hash`, `phone_hash`, `member_id_hash`, `device_id_hash`, `is_registered`, `metadata` |
| **`redemption_logs`** | دفتر کل استفاده از تخفیف (Ledger) | `id`, `member_id`, `order_id`, `created_at` — ⚠️ باید `unique(order_id)` + مکانیزم `voided`/حذف هنگام لغو داشته باشد |
| **`membership_requests`** | درخواست‌های ناموفق/دستی | `id`, `full_name`, `phone`, `member_id`, `organization_name`, `status` — ⚠️ متن ساده؛ زمان نگهداری باید تعریف شود |
| **`organizations`** | تنظیمات هر سازمان (باشگاه B2B) | `id`, `name`, `discount_percent`, `max_daily_orders` (**سقف روزانه برای هر عضو؛ null = نامحدود؛ قابل انتخاب موقع ساخت و قابل ویرایش در پنل**)، `max_total_orders` (⚠️ تعریف نهایی باقی است)، `expires_at`, `is_active` |

> ⚠️ ۴ جدول باشگاه (`organizations`، `organization_members`، `redemption_logs`، `membership_requests`) باید مثل `orders` با RLS قفل و فقط از Service Role در دسترس باشند (تأیید نشده).

### Storage Buckets:
- **`receipts`** (Private) — عکس رسیدهای واریز (Signed URL). فایل رسیدهای ردشده در باکت می‌مانند (فقط ارجاع در `orders` پاک می‌شود).

### وضعیت سفارش‌ها (status):
```
pending → confirmed → preparing → ready → delivered
       ↘ cancelled (با دلیل و cancelled_by)
```

### وضعیت پرداخت (payment_status):
```
unpaid  = روش انتخاب شده و رسیدی ثبت نشده (برای واریز: «منتظر آپلود رسید»)
  ↘ pending_review = رسید (عکس/متن) ثبت شده؛ فقط upload-receipt می‌نویسد؛ رسید قفل می‌شود
        ↘ paid   (تأیید ادمین)
        ↘ unpaid (رد رسید توسط ادمین → payment_receipt_url و payment_note پاک می‌شوند)
  ↘ paid   (تأیید آنلاین یا دستی)
  ↘ failed (پرداخت ناموفق)

اعلان ادمین (pending): payment_method in (cash, card) یا null، یا payment_status = paid،
یا (pending_review با payment_receipt_url یا payment_note غیر null)
```

### قانون تخفیف سفارش (باشگاه و کوپن):
```
اگر عضو باشگاه واجد تخفیف باشد:
  → تخفیف باشگاه اعمال می‌شود، coupon_code = 'MEMBERSHIP'
  → کوپن هم‌زمان اعمال نمی‌شود (ظرفیت کوپن مصرف نشود / با release_coupon برگردد)
سقف max_daily_orders برای هر عضو است (روز به وقت Asia/Tehran)
مصرف هر تخفیف در redemption_logs ثبت می‌شود؛ لغو سفارش سهمیه را برمی‌گرداند
```

### توابع PostgreSQL:
```sql
cleanup_old_orders()                    -- پاکسازی سفارش‌های قدیمی
get_cleanup_status()                    -- وضعیت پاکسازی خودکار
update_cleanup_settings(p_enabled, p_days)
consume_coupon(p_code)                  -- مصرف ظرفیت کوپن (بررسی نصب لازم)
release_coupon(p_code)                  -- آزادسازی ظرفیت کوپن هنگام لغو/شکست ثبت (بررسی نصب لازم)
cancel_order_by_customer(...)           -- لغو مشتری (بررسی دسترسی لازم)
reset_test_data(boolean, boolean, boolean) -- ⚠️ فقط تست؛ SECURITY DEFINER؛ باید حذف شود
-- (برنامه‌ریزی‌شده) RPC اتمیک ثبت سفارش + لاگ مصرف باشگاه + بررسی سقف‌ها
```

### pg_cron Setup:
```sql
-- نیاز به فعال‌سازی pg_cron از Dashboard → Database → Extensions
-- فایل کامل: supabase/cron-cleanup.sql

select cron.schedule(
  'auto-cleanup-orders',
  '0 3 * * *',
  $$select cleanup_old_orders()$$
);
```
---

## 🛠️ ۱۲. ابزارهای توسعه

| ابزار | مسیر | کاربرد |
|---|---|---|
| **منوی توسعه** | `dev.bat` | منوی همه‌کاره (با Build قبل از Push) |
| **پایان روز** | `end-of-day.bat` | بکاپ + push |
| **بکاپ لوکال** | `scripts/backup.mjs` | فقط سورس |
| **بکاپ سرور** | `scripts/backup-server.mjs` | کامل |
| **تغییر تم (سایدبار)** | `app/admin/components/AdminThemeToggle.tsx` | toggle روز/شب |
| **تغییر تم (موبایل)** | `app/admin/components/AdminMobileThemeToggle.tsx` | FAB |
| **اعلان سفارش** | `lib/use-order-notifications.ts` | Polling + صدا + Badge |
| **PWA Badge** | `lib/use-pwa-badge.ts` | setAppBadge |
| **کارت هشدار** | `app/admin/components/NewOrderAlert.tsx` | Toast |
| **تایتل داینامیک** | `lib/use-document-title.ts` | عنوان + favicon |
| **کامپوننت چاپ** | `app/admin/components/PrintInvoice.tsx` | فاکتور |
| **گزارش کوپن** | `app/admin/coupons/reports/` | گزارش |
| **گزارش فروش** | `app/admin/reports/sales/` | ۳ تب + CSV |
| **دلایل لغو** | `app/admin/cancellation-reasons/` | مدیریت |
| **آمار لغو** | `app/admin/cancellations/` | گزارش |
| **پنل مشتری** | `app/my-orders/MyOrdersClient.tsx` | داشبورد + تاریخچه + ثبت‌نام باشگاه |
| **مدیریت باشگاه** | `app/admin/memberships/` + `app/api/admin/memberships/` | سازمان‌ها، آپلود اکسل، درخواست‌ها، قوانین |
| **API باشگاه (مشتری)** | `app/api/membership/` | register, calculate, organizations, rules |
| **هش هویت** | `lib/utils/hash.ts` | `hashData()` (Salt + نرمال‌سازی فارسی) |
| **Web Push** | `lib/push/send-push.ts` + `public/sw.js` + `EnablePushCard.tsx` | ارسال و دریافت اعلان مرورگر |
| **مالکیت سفارش** | `lib/orders/owner.ts` | `getDeviceHash()` + `UUID_RE` |
| **خطای API** | `lib/api-error.ts` | `apiError()` پاسخ خطای امن |
| **پرداخت زرین‌پال** | `lib/payment/zarinpal.ts` | Request + Verify |
| **تنظیمات پرداخت** | `app/admin/settings/payment/` | فعال/غیرفعال + Merchant ID |
| **رد رسید (ادمین)** | `app/admin/orders/actions.ts` → `rejectReceipt` | برگرداندن به unpaid + پاک‌کردن رسید |
| **محافظت ادمین** | `proxy.ts` | server-side |
| **pg_cron Setup** | `supabase/cron-cleanup.sql` | راه‌اندازی |

---

## 📦 ۱۳. نسخه‌های نصب‌شده

### Dependencies:
```text
@supabase/ssr          ^0.5.2
@supabase/supabase-js  ^2.45.4
archiver               ^7.0.1
fontkit                ^2.0.4
next                   ^16.3.8
qrcode.react           ^4.2.0
react                  ^19.3.0
react-dom              ^19.3.0
sharp                  ^0.35.5
web-push               ^3.6.7
@types/web-push        ^3.6.4
xlsx                   (نسخه دقیق را از package.json چک کن؛ ⚠️ نسخه npm آسیب‌پذیر است)
react-multi-date-picker (نسخه دقیق را از package.json چک کن)
```

### DevDependencies:
```text
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
```text
node_modules/
.next/
.env
.env.local
.env.*.local
*.lnk
backups/
backups-server/
```

### `.gitattributes`:
```text
* text=auto eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf
*.png binary
*.jpg binary
*.ico binary
*.woff2 binary
*.ttf binary
*.zip binary
```

---

## 🐛 ۱۵. باگ‌های شناخته‌شده

> هیچ باگ عملکردی باز وجود ندارد. موارد امنیتی و منطقی باز در «بخش ۵. کارهای باقی‌مانده» ثبت شده‌اند.

| تاریخ | توضیح | وضعیت |
|---|---|---|
| 1405/08/08 | سفارش کارت‌به‌کارت بدون ارسال رسید در پنل/اعلان ادمین ظاهر می‌شد | ✅ رفع شد (`unpaid` + ثبت با روش واقعی + فیلتر اعلان) |
| 1405/08/08 | نبود دکمه «عدم تأیید رسید» در ادمین | ✅ رفع شد (`rejectReceipt` + دکمه) |
| 1405/08/08 | سفارش دارای فقط متن رسید اعلان نمی‌داد | ✅ رفع شد |
| 1405/08/08 | قفل رسید سمت سرور در `upload-receipt` اعمال نمی‌شد (`neq('paid')`) | ✅ رفع شد |
| 1405/08/08 | خطای build `Cannot find name 'updates'` در `set-method` | ✅ رفع شد |
| 1405/08/08 | دکمه‌های «تغییر روش پرداخت» با ظاهر خراب (متن چسبیده) | ✅ رفع شد (CSS) |
| 1405/08/08 | `HASH_SALT` در فایل مستندات نوشته شده بود | ⚠️ از فایل حذف شد؛ چرخش مقدار هنوز باقی است (بخش ۵) |

---

## 💡 ۱۶. تصمیمات فنی مهم

1. **بدون Tailwind:** تمام استایل‌ها در `globals.css`.
2. **Realtime Supabase:** برای لیست سفارش‌ها در ادمین.
3. **Polling برای اعلان سفارش‌ها:** هر ۱۰ ثانیه (تحریم WebSocket).
4. **Polling در صفحه جزئیات سفارش:** هر ۱۰ ثانیه (برای وضعیت پرداخت واریز: هر ۵ ثانیه).
5. **QR Token برای میزها:** `?table=N`.
6. **فونت داینامیک از دیتابیس.**
7. **localStorage برای سبد خرید.**
8. **واتساپ برای اطلاع‌رسانی.**
9. **متن‌های `.bat` به انگلیسی + ایموجی.**
10. **`.gitattributes` برای خط‌پایان‌ها.**
11. **Service Worker فقط در production.**
12. **کوپن با ارث‌بری.**
13. **محاسبه سهم تخفیف هر آیتم.**
14. **RLS policy:** حالا **کاملاً قفل** است. همه درخواست‌های حساس از طریق API با `SERVICE_ROLE_KEY` انجام می‌شوند.
15. **React Portal برای فاکتور چاپی.**
16. **دارک مود در localStorage.**
17. **صدا با AudioContext.**
18. **تایتل داینامیک با شمارش pending.**
19. **آیکون داینامیک با canvas.**
20. **`proxy.ts` به جای `middleware.ts`.**
21. **محافظت دو لایه.**
22. **`noindex, nofollow` روی صفحات ادمین.**
23. **کامپوننت چاپ مشترک.**
24. **گزارش کوپن با API جداگانه.**
25. **لغو با دلیل از دیتابیس.**
26. **لغو بدون دلیل مجاز.**
27. **نمایش دلیل لغو فقط وقتی admin.**
28. **سفارش حضوری از مسیر جدا ساخته می‌شود** (`api/admin/orders/create`)، چون قفل دستگاه و تخفیف باشگاه برای پرسنل مناسب نیست.
29. **برای لاگ تغییرات از `assertAdminId()` استفاده شود** (`assertAdmin()` شناسه برنمی‌گرداند).
30. **`next-env.d.ts` و `*.bak` commit نشوند.**
31. **برای هر ویژگی بزرگ شاخهٔ جدا بسازید** و بعد از تست Preview ادغام کنید.
28. **لغو با تاریخچه.**
29. **CSV با فرمول `=""`.**
30. **پشتیبانی Excel فارسی (BOM).**
31. **آمار لغو با نگاشت نام محصول به دسته.**
32. **هایلایت ستون پرلغو.**
33. **نمودار عریض با اسکرول افقی.**
34. **صفحه گزارش با کارت‌های کلیک‌پذیر.**
35. **مودال تودرتو با z-index بالاتر.**
36. **فچ API با `cache: 'no-store'`.**
37. **Fallback در کامپوننت‌های Client.**
38. **pg_cron برای پاکسازی خودکار.**
39. **تابع `cleanup_old_orders()` با security definer.**
40. **`get_cleanup_status()` برای cron.**
41. **تنظیمات cleanup در جدول settings.**
42. **Server Action به جای API Route.**
43. **گزارش فروش با سه تب.**
44. **CSV با BOM + `=""`.**
45. **عنوان گزارش در سطر اول CSV.**
46. **گزارش دسته‌بندی از نگاشت نام محصول.**
47. **ستون «لغو شده» به‌صورت کارت.**
48. **ناوبری موبایل با هدر + drawer.**
49. **بستن خودکار drawer در تغییر مسیر.**
50. **قفل اسکرول body وقتی drawer بازه.**
51. **بستن drawer با ESC.**
52. **حذف `flex: 1` از nav drawer.**
53. **ورود مشتری با کوکی دستگاه (بدون OTP):** جایگزین جدول `customer_sessions` شد. امن‌تر و ساده‌تر.
54. **Session مشتری با httpOnly cookie (۱ سال).**
55. **جستجوی چندفرمتی شماره در orders.**
56. **سفارش مجدد با map درست فیلدها.**
57. **PWA Badge با `navigator.setAppBadge`.**
58. **دکمه «سفارش‌های من» در hero منو.**
59. **سیستم پرداخت چندگانه:** پشتیبانی از آنلاین (زرین‌پال)، نقدی، کارت‌خوان و واریز با رسید.
60. **پرداخت آنلاین (زرین‌پال):** استفاده از Sandbox. پاس دادن `orderId` در callback. ذخیره Merchant ID در دیتابیس (با RLS قفل).
61. **آپلود رسید:** استفاده از Supabase Storage (Bucket خصوصی). استفاده از Signed URL برای مشاهده.
62. **مدیریت وضعیت پرداخت توسط ادمین:** با مودال تسویه.
63. **جلوگیری از اعلان سفارش‌های پرداخت‌نشده:** با فیلتر `.or()`.
64. **اجباری شدن شماره میز در Checkout.**
65. **جستجو و فیلتر در لیست سفارش‌ها.**
66. **رنگ‌بندی کارت‌های سفارش.**
67. **`dev.bat` با Build قبل از Push:** جلوگیری از خراب شدن سایت زنده.
68. **`stats.ts` کاملاً سروری است:** همه توابع آماری با Service Role کار می‌کنند و `server-only` دارند.
69. **تابع `supabaseAdmin()`:** یک تابع مشترک در `lib/supabase/server.ts` برای همه APIها.
70. **بنر موفقیت با `sessionStorage`:** فلگ `cafe-park-order-success-${id}` فقط یک بار خوانده و پاک می‌شود.
71. **رسید قبلی در `UploadReceipt`:** با پراپ `initialUrl` نمایش داده می‌شود.
72. **دکمه «تغییر رسید»:** با کلاس `.receipt-replace-btn`.
73. **شماره میز خودکار از QR:** `MenuClient` → `sessionStorage` → Cart → Checkout با برچسب «✅ از QR تشخیص داده شد».
74. **نوار شناور sticky سبد خرید:** `.cart-floating-bar` با `position: fixed` و الگوی `pointer-events`.
75. **پاکسازی ساختاری `globals.css`:** حذف بلوک‌های تکراری؛ بعد از هر پاکسازی `npm run build` اجباری است.
76. **`Suspense` برای `useSearchParams`:** در Next.js 16 الزامی است (`CartPage` به `CartPage` + `CartContent` تقسیم شد).
77. **ادغام پرداخت نقدی و کارت‌خوان:** در UI مشتری و ادمین «پرداخت در محل»؛ دیتابیس هر دو را پشتیبانی می‌کند.
78. **مالکیت سفارش با کوکی دستگاه:** `cafe_device_token` در سرور به `device_id_hash` تبدیل و در `orders` ذخیره می‌شود. APIهای مشتری با `getDeviceHash()` فقط سفارش همان دستگاه را برمی‌گردانند؛ برای بقیه `404`. (پیامد: لینک سفارش روی دستگاه دیگر باز نمی‌شود.)
79. **تفکیک `unpaid` و `pending_review` برای واریز:** انتخاب روش واریز، سفارش را وارد صف بررسی ادمین نمی‌کند؛ فقط ثبت رسید از `upload-receipt` وضعیت را به `pending_review` می‌برد. فیلتر اعلان ادمین هر دو شرط را چک می‌کند.
80. **قفل رسید سمت سرور:** در `upload-receipt` شرط‌های `payment_method = transfer`، وضعیت `unpaid/failed/pending_review` و خالی‌بودن هر دو فیلد رسید در خود کوئری `update` اعمال می‌شود (اتمیک؛ عکس و متن باید در یک درخواست بیایند).
81. **رد رسید توسط ادمین (`rejectReceipt`):** وضعیت `unpaid` می‌شود و ارجاع رسید پاک می‌شود (فایل در باکت می‌ماند)؛ صفحه مشتری با polling هر ۵ ثانیه دکمه‌ها را دوباره باز می‌کند.
82. **ثبت سفارش با روش پرداخت واقعی:** `payment_method` از body خوانده و با فهرست مجاز (`cash/card/transfer/online`) اعتبارسنجی می‌شود؛ پیش‌فرض `cash`. فراخوانی بعدی `set-method` بی‌ضرر و idempotent است.
83. **قفل لغو بر پایه وجود رسید:** لغو مشتری با «ارسال‌نشدن رسید و پرداخت‌نشدن» سنجیده شود، نه با `pending_review` به‌تنهایی (طراحی؛ پیاده‌سازی نهایی باقی است).
84. **خروجی PowerShell:** خرابی نمایش فارسی در کنسول مشکل رمزگذاری نمایش است، نه فایل؛ با `-Encoding UTF8` خوانده شود.
85. **معماری باشگاه مشتریان (Ledger Pattern):** سابقه استفاده از تخفیف‌ها در `redemption_logs` ثبت می‌شود تا باگ Race Condition پیش نیاید. (شمارش واقعی باید داخل RPC اتمیک باشد.)
86. **هش کردن داده‌های حساس:** نام، تلفن و شماره دانشجویی با `SHA-256` + `Salt` (`HASH_SALT`) هش می‌شوند. (هدف: مهاجرت به `HMAC-SHA256` با کلید مخفی سروری.)
87. **نرمال‌سازی قبل از هش:** حروف عربی (ي، ك) به فارسی، نیم‌فاصله حذف و فاصله‌های اضافی اصلاح می‌شوند.
88. **پردازش اکسل سمت کلاینت:** خواندن فایل با `xlsx` در مرورگر انجام می‌شود تا ادمین قبل از ثبت، داده‌ها را ویرایش کند.
89. **ریسپانسیو اختصاصی موبایل:** صفحه اصلی منو در موبایل با CSS بهینه شد (حذف بک‌گراند، هدر کوچک، گرید ۳ ستونه).
90. **تقویم شمسی:** `react-multi-date-picker` برای تاریخ انقضای قرارداد در پنل ادمین (تبدیل به پایان روز تهران باقی است).
91. **جلوگیری از ثبت‌نام تکراری:** هر شماره تلفن یا شماره دانشجویی فقط یک بار می‌تواند ثبت‌نام کند.
92. **سقف روزانه باشگاه برای هر شخص (عضو) در سازمان است**، نه برای کل سازمان. این مقدار تنظیم هر سازمان است: هنگام ساخت سازمان انتخاب می‌شود و بعداً در پنل ادمین قابل ویرایش است. مقدار خالی (`null`) یعنی بدون محدودیت. روز به وقت `Asia/Tehran` حساب می‌شود و تغییر سقف فقط روی سفارش‌های بعدی اثر دارد.
93. **تخفیف باشگاه اولویت دارد و با کوپن ترکیب نمی‌شود:** وقتی تخفیف باشگاه اعمال شود، `coupon_code = 'MEMBERSHIP'` ثبت می‌شود و کوپن اعمال نمی‌شود؛ ظرفیت کوپن نباید مصرف شود (یا با `release_coupon` برگردد) و UI کوپن را غیرفعال نشان می‌دهد.
94. **محاسبه تخفیف باشگاه فقط سروری:** `orders/route.ts` تخفیف را دوباره حساب می‌کند؛ `/api/membership/calculate` فقط پیش‌نمایش است.
95. **برگشت سهمیه:** لغو سفارش یا شکست ثبت سفارش بعد از ثبت لاگ، سهمیه عضو را برمی‌گرداند (ردیف `redemption_logs` حذف یا `voided` می‌شود و شمارش‌ها فقط ردیف‌های فعال را می‌شمارند).
96. **قواعد اعتبار جدا از `memberships`:** بر پایهٔ سابقهٔ مشتری (سفارش تسویه‌شده، بدهی باز، تأیید شماره).
97. **بدهی باز** = مجموع سفارش‌های غیرلغو/غیرحذف‌شده منهای پرداخت‌های `confirmed` در `order_payments`.
98. **سفارش حضوری بدون تخفیف و کوپن** ساخته و با ابزار تسویهٔ موجود تسویه می‌شود.
99. **مشتری بی‌نام** = شمارهٔ خالی؛ در CRM نیست ولی در سفارش‌ها و گزارش‌ها هست.
