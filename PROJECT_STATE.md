# 📋 PROJECT_STATE.md — کافه پارک

> این فایل سند زنده پروژه است. هر بار که تغییری اعمال شد،
> بخش «۵. کارهای باقی‌مانده»، «۸. لاگ تغییرات» و «بالای فایل» رو آپدیت کن.
> در چت جدید، فقط همین فایل را برای AI پیوست کن.

**آخرین آپدیت:** ۱۴۰۵/۰۸/۰۴ (2026-10-26)

---

## 🎯 ۱. خلاصه پروژه

- **نام پکیج:** `cafe-park-menu` (پوشه پروژه: `Cofe-Park`)
- **تکنولوژی:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase + `globals.css` (بدون Tailwind)
- **هدف:** مشتری‌ها با اسکن QR روی میز، منو را باز می‌کنند، سفارش می‌دهند و از طریق واتساپ به کافه می‌فرستند. صاحب کافه هم از پنل ادمین، سفارش‌ها، منو، میزها، تم‌ها و تنظیمات را مدیریت می‌کند. مشتری‌ها می‌توانند بدون کد و فقط با شناسه دستگاه (کوکی امن)، سفارش‌های قبلی خود را ببینند. سیستم پرداخت چندگانه (آنلاین زرین‌پال، نقدی، کارت‌خوان، واریز با رسید) پیاده‌سازی شده است.
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
│   ├── MenuClient.tsx              ← کلاینت منوی مشتری (+ دکمه سفارش‌های من)
│   ├── layout.tsx                  ← Root Layout (فونت + متادیتای SEO)
│   ├── globals.css                 ← ✅ تنها فایل استایل پروژه (۸۴ بخش)
│   ├── manifest.ts                 ← PWA Manifest
│   ├── robots.ts                   ← robots.txt
│   ├── sitemap.ts                  ← sitemap.xml
│   ├── cart/page.tsx               ← صفحه سبد خرید
│   ├── checkout/page.tsx           ← صفحه ثبت سفارش + کوپن + انتخاب پرداخت
│   ├── my-orders/                  ← ✅ پنل مشتری (بدون OTP)
│   │   ├── page.tsx
│   │   └── MyOrdersClient.tsx      ← تاریخچه سفارش‌ها با کوکی دستگاه
│   ├── order/[id]/                 ← جزئیات سفارش مشتری
│   │   ├── page.tsx                ← صفحه اصلی سفارش + وضعیت پرداخت
│   │   └── UploadReceipt.tsx       ← ✅ آپلود رسید (عکس/متن + نمایش رسید قبلی)
│   ├── payment/callback/           ← ✅ بازگشت از درگاه پرداخت
│   │   ├── page.tsx
│   │   └── PaymentCallbackClient.tsx
│   ├── api/
│   │   ├── admin/                  ← ✅ APIهای امن ادمین
│   │   │   ├── customers/route.ts  ← دریافت لیست CRM
│   │   │   └── orders/pending/route.ts ← اعلان‌ها
│   │   ├── orders/
│   │   │   ├── route.ts            ← API ثبت سفارش (ست کردن کوکی دستگاه)
│   │   │   ├── [id]/route.ts       ← دریافت سفارش (با Service Role)
│   │   │   └── cancel/route.ts     ← API لغو سفارش
│   │   ├── customer/               ← ✅ API پنل مشتری (با Service Role)
│   │   │   ├── me/route.ts         ← اطلاعات دستگاه فعلی
│   │   │   └── orders/route.ts     ← سفارش‌های دستگاه فعلی
│   │   ├── payment/                ← ✅ API پرداخت (با Service Role)
│   │   │   ├── settings/route.ts   
│   │   │   ├── request/route.ts    
│   │   │   ├── verify/route.ts     
│   │   │   ├── set-method/route.ts 
│   │   │   └── upload-receipt/route.ts 
│   │   ├── upload-receipt/route.ts ← آپلود به Storage (Signed URL)
│   │   ├── coupons/                
│   │   ├── cancellation-reasons/   ← با Service Role
│   │   ├── cancellations/          
│   │   ├── customers/update/route.ts ← ذخیره یادداشت/تگ CRM
│   │   ├── reports/sales/route.ts  
│   │   ├── cleanup/                
│   │   └── export/                 
│   ├── components/                 
│   └── admin/
│       ├── layout.tsx              ← هدر موبایل + drawer + اعلان سفارش
│       ├── orders/                 ← مدیریت سفارش‌ها
│       │   ├── page.tsx            ← لود مستقیم با Service Role
│       │   ├── OrdersManager.tsx   ← لیست + جستجو + فیلتر + مودال تسویه
│       │   └── actions.ts          ← اکشن‌ها با Service Role
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
│   ├── payment/zarinpal.ts         ← توابع ارتباط با زرین‌پال
│   ├── use-order-notifications.ts  ← Polling از API امن
│   ├── use-pwa-badge.ts            
│   ├── use-document-title.ts
│   └── supabase/
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
| **رنگ تخفیف / موفقیت** | `#2d5d3e` / `#477052` | متن تخفیف‌ها (سبز) |
| **رنگ کوپن غیرفعال / لغو / خطا** | `#9b3c32` | هشدارها، بج‌های منفی، لغو |
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

**آمار لغوها:** `.cancellation-summary-grid` / `.cancellation-summary-card` / `.cancellation-summary-icon` / `.cancellation-reasons-chart` / `.cancellation-chart-row` / `.cancellation-chart-bar` / `.cancellation-table` / `.cancellation-reason-badge` / `.cancellation-by.by-customer` / `.cancellation-by.by-admin` / `.cancellation-row-clickable`

**آمار پیشرفته لغو:** `.cancel-wide-chart` / `.cancel-peak-bar` / `.cancel-chart-hint`

**کارت‌های گزارش:** `.report-cards-grid` / `.report-card` / `.report-card-icon` / `.report-card-body` / `.report-card-title` / `.report-card-value` / `.report-card-hint` / `.report-card-arrow`

**مشتریان (CRM):** `.customers-summary-grid` / `.customers-summary-card` / `.customers-grid` / `.customer-card` / `.customer-avatar` / `.customer-badge` / `.customer-action-btn` / `.preset-tag-btn` / `.custom-tag` / `.customer-notes-input`

**پاکسازی خودکار:** `.cleanup-wrapper` / `.auto-cleanup-card` / `.auto-icon` / `.auto-status-badge` / `.auto-toggle-row` / `.auto-switch` / `.auto-switch-track` / `.auto-switch-thumb` / `.auto-days-row` / `.auto-last-run` / `.auto-last-run-title` / `.auto-last-run-row` / `.auto-last-run-message` / `.auto-last-run-empty`

**گزارش فروش:** `.report-export-actions` / `.sales-summary-grid` / `.sales-summary-card` / `.sales-summary-icon` / `.sales-summary-content` / `.sales-summary-value` / `.sales-summary-label` / `.sales-view-tabs` / `.sales-view-tab` / `.sales-table-wrapper` / `.sales-table` / `.sales-table-num` / `.sales-table-amount` / `.sales-table-discount` / `.sales-table-rank` / `.sales-table-percent` / `.sales-bar-mini` / `.sales-bar-mini-fill` / `.sales-cat-icon` / `.sales-report-hint`

**فیلتر لغو CRM:** `.customers-cancel-filters` / `.customers-cancel-label` / `.customers-cancel-chips` / `.filter-chip.cancel-chip` / `.chip-count` / `.customers-filter-result` / `.customer-card-highlight` / `.cancelled-emphasis`

**هدر و Drawer موبایل:** `.admin-mobile-header` / `.admin-mobile-menu-btn` / `.admin-mobile-logo` / `.admin-mobile-header-badge` / `.admin-drawer-overlay` / `.admin-drawer` / `.admin-drawer-header` / `.admin-drawer-nav` / `.admin-drawer-item` / `.admin-drawer-icon` / `.admin-drawer-label` / `.admin-drawer-badge` / `.admin-drawer-footer` / `.admin-drawer-logout` / `.admin-drawer-close`

**پنل مشتری:** `.my-orders-page` / `.my-orders-header` / `.my-orders-back` / `.my-orders-logout` / `.my-orders-user` / `.my-orders-user-icon` / `.my-orders-filters` / `.my-orders-list` / `.my-orders-empty` / `.my-order-card` / `.my-order-header` / `.my-order-num` / `.my-order-status` / `.my-order-date` / `.my-order-items` / `.my-order-item` / `.my-order-item-more` / `.my-order-total` / `.my-order-cancel-reason` / `.my-order-actions` / `.my-order-btn` / `.customer-login-card` / `.customer-login-icon` / `.customer-login-hint` / `.customer-login-field` / `.customer-login-btn` / `.customer-login-link` / `.customer-login-error` / `.customer-login-code-display` / `.hero-my-orders-btn`

**تنظیمات پرداخت:** `.payment-settings-page` / `.payment-section` / `.payment-section-header` / `.payment-section-icon` / `.payment-section-title` / `.payment-section-hint` / `.payment-warning` / `.payment-sandbox-warning` / `.payment-methods-grid` / `.payment-method-card` / `.payment-method-icon` / `.payment-method-info` / `.payment-gateway-options` / `.payment-gateway-option` / `.payment-toggle-row` / `.payment-toggle-info` / `.payment-coming-soon` / `.payment-save-bar`

**انتخاب پرداخت (Checkout):** `.payment-methods-selector` / `.payment-method-option` / `.payment-method-option-icon` / `.payment-method-option-info` / `.payment-method-option-check` / `.payment-transfer-info` / `.payment-transfer-info-title` / `.payment-transfer-row` / `.payment-transfer-hint`

**بازگشت از درگاه:** `.payment-callback-page` / `.payment-callback-card` / `.payment-callback-icon` / `.payment-callback-desc` / `.payment-callback-ref` / `.payment-callback-actions`

**پرداخت در صفحه سفارش (مشتری):** `.order-payment-badge` / `.order-payment-badge-ref` / `.order-payment-section` / `.order-payment-section-title` / `.order-payment-section-desc` / `.order-payment-actions` / `.order-payment-btn` / `.order-payment-methods` / `.order-payment-method-btn` / `.order-payment-method-icon`

**پرداخت در پنل ادمین:** `.order-card--unpaid` / `.order-card--pending` / `.order-card--paid` / `.order-card--failed` / `.order-payment-badge-inline` / `.order-payment-ref-id` / `.order-receipt-link` / `.payment-status-text` / `.payment-approve-form` / `.orders-search-box`

**آپلود رسید:** `.receipt-upload-box` / `.receipt-mode-tabs` / `.receipt-mode-tab` / `.receipt-upload-label` / `.receipt-upload-icon` / `.receipt-upload-text` / `.receipt-upload-progress` / `.receipt-upload-error` / `.receipt-preview` / `.receipt-preview-hint` / `.receipt-note-input` / `.receipt-submit-btn` / `.receipt-replace-btn`

**بنر موفقیت سفارش:** `.order-success-banner` / `.order-success-icon` / `.order-success-body` / `.order-success-title` / `.order-success-text` / `.order-success-hint` / `.order-success-close`

**لغو سفارش (تکمیلی):** `.order-cancel-success` / `.order-cancel-btn` / `.order-cancel-hint` / `.cancellation-info-box` / `.cancellation-info-label` / `.cancellation-info-note` / `.cancellation-info-by`

**خلاصه مبلغ پرداخت:** `.order-payment-summary` / `.discount` / `.total-row`

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
| 72 | AUTO CLEANUP (پاکسازی خودکار Cron) |
| 73 | SALES REPORTS (گزارش فروش و مالیات) |
| 74 | CUSTOMERS CANCEL FILTER (فیلتر لغو در CRM) |
| 75 | ADMIN MOBILE THEME TOGGLE (دکمه شناور حالت شبانه) |
| 76 | ADMIN MOBILE HEADER + DRAWER (هدر موبایل + drawer سه‌خطی) |
| 77 | CUSTOMER PANEL (پنل مشتری) |
| 78 | PAYMENT SETTINGS (تنظیمات پرداخت در ادمین) |
| 79 | PAYMENT (انتخاب روش پرداخت + بازگشت از درگاه) |
| 80 | ORDER PAYMENT (بخش پرداخت در صفحه سفارش) |
| 81 | ADMIN ORDER PAYMENT BADGES (بج‌های پرداخت ادمین) |
| 82 | RECEIPT UPLOAD (آپلود رسید) |
| 83 | ADMIN ORDER PAYMENT COLORS (رنگ‌بندی کارت‌های ادمین) |
| 84 | ADMIN ORDERS SEARCH (نوار جستجوی سفارش‌ها) |

---

## ✅ ۴. کارهای انجام‌شده

### 🔒 امنیت (فاز جدید)
- [x] **قفل کردن کامل RLS روی جداول حساس:** `orders`, `coupons`, `customers`, `cancellation_reasons`, `settings`. (حذف Policyهای عمومی)
- [x] **انتقال همه APIها به `SERVICE_ROLE_KEY`:** ثبت سفارش، پرداخت، لغو، CRM، آپلود رسید و دریافت تنظیمات. (کلید فقط روی سرور است)
- [x] **جایگزینی OTP با «کوکی دستگاه»:** مشتری بدون کد، فقط با کوکی امن `cafe_device_token` سفارش‌های دستگاه خودش را می‌بیند.
- [x] **حذف جدول `customer_sessions` و فایل‌های OTP.**
- [x] **خصوصی کردن Storage `receipts`:** استفاده از Signed URL برای مشاهده رسید.
- [x] **ذخیره `payment_merchant_id` در دیتابیس:** حالا با RLS امن شده و از پنل ادمین قابل تنظیم است.
- [x] **آپدیت `dev.bat`:** بیلد اجباری قبل از پوش برای جلوگیری از خرابی سایت.

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
- [x] **انتخاب روش پرداخت در Checkout** (آنلاین، نقدی، کارت‌خوان، واریز)
- [x] **اجباری شدن شماره میز در Checkout**
- [x] **صفحه بازگشت از درگاه** (`/payment/callback`)
- [x] **آپلود رسید (عکس/متن)** برای پرداخت واریزی
- [x] **بخش پرداخت در صفحه سفارش**
- [x] **بنر موفقیت بعد از ثبت سفارش** (با `sessionStorage`)

### پنل ادمین
- [x] Layout با سایدبار + هدر موبایل + drawer کشویی
- [x] لاگین + محافظت سرور-side + متادیتای `noindex`
- [x] **داشبورد با آمار پیشرفته**
- [x] **پاکسازی خودکار سفارش‌های قدیمی** با pg_cron
- [x] **گزارش فروش و مالیات** (۳ تب + ۶ فیلتر + خروجی CSV)
- [x] **مدیریت سفارش‌ها** + Realtime + فاکتور چاپی
- [x] **مدیریت سفارش‌ها: جستجو، فیلتر، رنگ‌بندی، تسویه سریع و مودال تسویه**
- [x] **مدیریت سفارش‌ها: نمایش رسید واریز**
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

### زیرساخت و ابزارها
- [x] سیستم تم داینامیک + Supabase Server/Browser Client + Cart Context
- [x] بکاپ لوکال/سرور + بکاپ خودکار + `dev.bat` + `end-of-day.bat`
- [x] PWA کامل + SEO کامل
- [x] امنیت: `poweredByHeader: false` + `proxy.ts` + `noindex`
- [x] Deploy روی Vercel
- [x] pg_cron
- [x] Storage Bucket (`receipts` - Private)
- [x] درگاه زرین‌پال

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
- [x] **رفع باگ آپلود رسید (فاز ۱):** انتقال API به `supabaseAdmin`، مدیریت خطای JSON سرور، کاهش محدودیت حجم به ۳MB و نمایش مجدد عکس در صفحه سفارش.
- [x] **افزودن دکمه «تحویل بدون تسویه»:** به مودال تسویه ادمین اضافه شد تا سفارش بدون تغییر وضعیت پرداخت تحویل داده شود.
- [x] **رفع باگ گزارش کوپن‌ها:** مودال سفارش‌های کوپن که خالی نمایش داده می‌شد، به `supabaseAdmin` منتقل شد.
- [x] **رفع باگ دراور ادمین:** اسکرول پس‌زمینه قفل شد و هدر موبایل با `position: fixed` ثابت ماند.
- [x] **یکدست‌سازی تب‌های ادمین:** کلاس‌های `stat-tabs` ایجاد شد تا در همه صفحات (سفارش‌ها، CRM، گزارش‌ها) مشترک باشد.
- [x] **رفع باگ قطع ارتباط داشبورد با دیتابیس:** `lib/stats.ts` به `SUPABASE_SERVICE_ROLE_KEY` و `server-only` منتقل شد.
- [x] **رفع باگ نمایش تکراری تاریخ ثبت سفارش:** «تاریخ ثبت» که اشتباهاً داخل `order.items.map()` بود، به بیرون حلقه منتقل شد تا فقط یک بار نمایش داده شود.
- [x] **افزودن نمایش رسید قبلی در `UploadReceipt`:** پراپ `initialUrl` به `Props` اضافه شد تا اگر مشتری قبلاً رسید آپلود کرده باشد، همان عکس نمایش داده شود (نه فرم خالی).
- [x] **افزودن دکمه «🔄 تغییر رسید»:** اگر کاربر قبلاً رسید آپلود کرده باشد، با زدن این دکمه می‌تواند رسید جدید آپلود کند (قبلاً گیر می‌کرد).
- [x] **رفع خطای TypeScript `Duplicate identifier` در `menu-types.ts`:** فیلدهای تکراری `floating_enabled` و `floating_side` در interface `Settings` حذف شدند.

---

## 🚧 ۵. کارهای باقی‌مانده

> اولویت‌ها: 🔴 بالا / 🟡 متوسط / 🟢 پایین

- [ ] 🔴 **تست کامل روی موبایل واقعی** (iOS Safari + Chrome Android)
- [ ] 🔴 **تست کامل جریان سفارش** از ابتدا تا انتها (با همه روش‌های پرداخت)
- [ ] 🟡 **ثابت (sticky) کردن آیکون سبد خرید** در همه صفحات (به‌جای ناپدید شدن بعد از اسکرول)
- [ ] 🟡 **شماره میز خودکار از لینک QR:** موقع باز شدن `/cart?table=N`، مقدار `table` از URL خونده بشه و به‌صورت خودکار در Checkout پر بشه (تا الان اجبار به وارد کردن دستی هست)
- [ ] 🟡 **بررسی نهایی آپلود عکس در پرداخت کارت‌به‌کارت** با گوشی واقعی (تست‌های چت قبلی ناتمام موندن)
- [ ] 🟢 **ایمیل/SMS اطلاع‌رسانی** برای سفارش‌های جدید و تحویل شده
- [ ] 🟢 **تست بار (Load Test)** روی Supabase
- [ ] 🟢 **آیکون PWA با badge برای مشتری**
- [ ] 🟢 **اتصال به درگاه پرداخت‌های دیگر** (آیدی‌پی، نکست‌پی) — زیرساخت آماده است
- [ ] 🟢 **اتصال به نرم‌افزار حسابداری پارسیان**
- [ ] 🟢 **سیستم پیامک (SMS) برای OTP** (جایگزینی کوکی دستگاه در آینده)
- [ ] 🟢 **افزودن جزئیات بیشتر به مودال تسویه**

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
18. **برای عملیات دیتابیسی در سرور (API ها)، به‌جای ساخت کلاینت جدید، همیشه از تابع `supabaseAdmin()` از فایل `lib/supabase/server.ts` استفاده شود.** (به دلیل قفل بودن RLS)
19. **پراپ‌های کامپوننت باید در `type Props` تعریف شوند — اضافه کردن پراپ جدید بدون تعریف در `Props`، خطای بیلد می‌دهد.**

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
5. بخش‌های globals.css شماره‌گذاری شده‌اند (۱ تا ۸۴).
6. برای اعلان‌ها از Polling استفاده شود، نه Realtime (تحریم ایران).
7. محافظت ادمین با proxy.ts (نه middleware.ts در Next.js 16).
8. در fetch های API از cache: 'no-store' استفاده شود.
9. در کوئری سفارش‌های مشتری، با چند فرمت شماره جستجو شود.
10. به دلیل قفل بودن RLS، همه APIهای حساس باید از SERVICE_ROLE_KEY استفاده کنند.
11. هر پراپ جدید کامپوننت باید در `type Props` تعریف شود، وگرنه بیلد fail می‌شود.

📁 ابزارهای موجود در پروژه:
- dev.bat → منوی همه‌کاره توسعه
- end-of-day.bat → اسکریپت پایان روز
- npm run backup / backup:server / backup:clean
- npm run build:icons / transparent
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
| 1405/08/04 | **آپدیت `PROJECT_STATE.md`:** افزودن بنر موفقیت سفارش، بهبود UX آپلود رسید (نمایش رسید قبلی + دکمه تغییر)، رفع باگ نمایش تکراری تاریخ در ریز اقلام، و حذف فیلدهای تکراری `floating_*` در `menu-types.ts`. |

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

### متغیرهای محیطی (`.env.local` و Vercel):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
NEXT_PUBLIC_SITE_URL=https://cafe-park-menu.vercel.app
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
| `orders` | سفارش‌ها | `id`, `order_number`, `customer_name`, `customer_phone`, `table_number`, `note`, `items` (JSONB), `subtotal`, `status`, `original_subtotal`, `coupon_code`, `coupon_discount`, `eligible_subtotal`, `ineligible_subtotal`, `cancellation_reason_id`, `cancellation_reason_label`, `cancellation_note`, `cancelled_by`, **`payment_method`**, **`payment_status`**, **`payment_authority`**, **`payment_ref_id`**, **`payment_amount`**, **`payment_receipt_url`**, **`payment_verified_at`**, **`payment_note`**, **`device_id_hash`**, `created_at`, `confirmed_at`, `preparing_at`, `ready_at`, `delivered_at`, `cancelled_at` |
| `tables` | میزها | `id`, `number`, `name`, `description`, `capacity`, `location`, `sort_order`, `is_active`, `qr_token` |
| `quotes` | جملات | `id`, `text`, `author`, `is_active` |
| `themes` | تم‌ها | رنگ‌ها + font_url‌ها + `font_metadata` (JSONB), `border_radius`, `is_active` |
| `settings` | تنظیمات سایت (id=1) | `cafe_name`, `tagline`, `hero_*`, `footer_text`, `address`, `phone`, `instagram`, `working_hours`, `logo_url`, `maps_url`, `og_*`, `show_*`, `*_in_header/footer/floating`, `auto_cleanup_enabled`, `auto_cleanup_days`, **`payment_enabled`**, **`payment_online_enabled`**, **`payment_cash_enabled`**, **`payment_card_enabled`**, **`payment_transfer_enabled`**, **`payment_gateway`**, **`payment_merchant_id`**, **`payment_sandbox_mode`**, **`payment_min_online_amount`**, **`payment_transfer_bank_name`**, **`payment_transfer_account_number`**, **`payment_transfer_card_number`**, **`payment_transfer_account_holder`**, **`payment_transfer_requires_review`**, **`payment_transfer_auto_verify`**, **`admin_allow_delete_orders`** |
| `coupons` | کدهای تخفیف | `id`, `code`, `description`, `discount_type`, `discount_value`, `min_order_amount`, `max_order_amount`, `max_discount`, `max_uses`, `used_count`, `valid_from`, `valid_until`, `is_active` |
| `customers` | مشتریان (از سفارش‌ها) | `phone`, `notes`, `tags`, `updated_at` |
| `cancellation_reasons` | دلایل لغو | `id`, `label`, `target`, `icon`, `sort_order`, `is_active` |

### Storage Buckets:
- **`receipts`** (Private) — برای ذخیره عکس رسیدهای واریز بانکی (با Signed URL).

### وضعیت سفارش‌ها (status):
```
pending → confirmed → preparing → ready → delivered
       ↘ cancelled (با دلیل و cancelled_by)
```

### وضعیت پرداخت (payment_status):
```
unpaid → paid (تأیید آنلاین یا دستی)
       ↘ failed (پرداخت ناموفق)
       ↘ pending_review (واریز با رسید، منتظر تأیید ادمین)
```

### توابع PostgreSQL:
```sql
cleanup_old_orders()                    -- پاکسازی سفارش‌های قدیمی
get_cleanup_status()                    -- وضعیت پاکسازی خودکار
update_cleanup_settings(p_enabled, p_days)
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
| **پنل مشتری** | `app/my-orders/MyOrdersClient.tsx` | بدون OTP (کوکی) |
| **پرداخت زرین‌پال** | `lib/payment/zarinpal.ts` | Request + Verify |
| **تنظیمات پرداخت** | `app/admin/settings/payment/` | فعال/غیرفعال + Merchant ID |
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

> هیچ باگ باز فعلی وجود ندارد.

| تاریخ | توضیح | وضعیت |
|---|---|---|
| — | — | — |

---

## 💡 ۱۶. تصمیمات فنی مهم

1. **بدون Tailwind:** تمام استایل‌ها در `globals.css`.
2. **Realtime Supabase:** برای لیست سفارش‌ها در ادمین.
3. **Polling برای اعلان سفارش‌ها:** هر ۱۰ ثانیه (تحریم WebSocket).
4. **Polling در صفحه جزئیات سفارش:** هر ۱۰ ثانیه.
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
68. **`stats.ts` کاملاً سروری است:** همه توابع آماری (`getOrderStats`, `getCancellationStats`, `getSalesReport`, `getCouponStats`, `getCustomersData`) با Service Role کار می‌کنند و `server-only` دارند.
69. **تابع `supabaseAdmin()`:** یک تابع مشترک در `lib/supabase/server.ts` ایجاد شد تا در تمام APIها به جای `createClient` تکراری استفاده شود و همیشه RLS را دور بزند.
70. **بنر موفقیت با `sessionStorage`:** بعد از redirect از Checkout به صفحه سفارش، یک فلگ `cafe-park-order-success-${id}` در `sessionStorage` ست می‌شه و در `order/[id]/page.tsx` فقط یک بار خونده و پاک می‌شه (بهبود UX، جلوگیری از نمایش مکرر).
71. **رسید قبلی در `UploadReceipt`:** با پراپ `initialUrl`، اگر رسید قبلی وجود داشته باشد در پیش‌نمایش نمایش داده می‌شود — جلوگیری از آپلود مکرر.
72. **دکمه «تغییر رسید»:** با کلاس `.receipt-replace-btn` کاربر می‌تواند رسید آپلود شده را جایگزین کند (قبلاً چون `preview` از `initialUrl` پر می‌شد، دکمه آپلود مجدد مخفی می‌ماند و کاربر گیر می‌کرد).