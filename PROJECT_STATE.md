# 📋 PROJECT_STATE.md — کافه پارک

> این فایل سند زنده پروژه است. هر بار که تغییری اعمال شد،
> بخش «۵. کارهای باقی‌مانده»، «۸. لاگ تغییرات» و «بالای فایل» رو آپدیت کن.
> در چت جدید، فقط همین فایل را برای AI پیوست کن.

**آخرین آپدیت:** ۱۴۰۵/۰۷/۱۹ (2026-10-11)

---

## 🎯 ۱. خلاصه پروژه

- **نام پکیج:** `cafe-park-menu` (پوشه پروژه: `Cofe-Park`)
- **تکنولوژی:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase + `globals.css` (بدون Tailwind)
- **هدف:** مشتری‌ها با اسکن QR روی میز، منو را باز می‌کنند، سفارش می‌دهند و از طریق واتساپ به کافه می‌فرستند. صاحب کافه هم از پنل ادمین، سفارش‌ها، منو، میزها، تم‌ها و تنظیمات را مدیریت می‌کند.
- **دیتابیس:** Supabase (PostgreSQL) + Realtime برای آپدیت لحظه‌ای سفارش‌ها
- **ریپازیتوری:** `https://github.com/hadiassadi/cafe-park-menu.git` (branch: `main`)
- **مسیر لوکال:** `D:\Cafe Park\Menu\New Menu\CafePark-Menu\Cofe-Park`

---

## 🗂️ ۲. ساختار پروژه

```
Cofe-Park/
├── app/
│   ├── page.tsx                    ← صفحه اصلی (SSR، getMenuData، revalidate: 300)
│   ├── MenuClient.tsx              ← کلاینت منوی مشتری (جستجو، فیلتر، دسته، مودال)
│   ├── layout.tsx                  ← Layout اصلی (فونت Vazirmatn)
│   ├── globals.css                 ← ✅ تنها فایل استایل پروژه (۴۲ بخش)
│   ├── cart/
│   │   └── page.tsx                ← ✅ صفحه سبد خرید
│   ├── checkout/
│   │   └── page.tsx                ← ✅ صفحه ثبت سفارش (Suspense + CheckoutForm)
│   ├── order/[id]/
│   │   └── page.tsx                ← ✅ صفحه جزئیات سفارش مشتری (polling هر ۱۰ ثانیه)
│   ├── api/orders/
│   │   └── route.ts                ← API ثبت سفارش (POST)
│   ├── components/
│   │   ├── ProductDetailModal.tsx  ← ✅ مودال جزئیات محصول
│   │   ├── CartFloatingBar.tsx     ← ✅ نوار شناور سبد
│   │   └── Modal.tsx               ← مودال عمومی ادمین
│   └── admin/
│       ├── layout.tsx              ← Layout پنل ادمین (سایدبار دسکتاپ + منوی پایین موبایل)
│       ├── login/page.tsx          ← ✅ صفحه لاگین
│       ├── page.tsx                ← داشبورد
│       ├── orders/
│       │   ├── page.tsx            ← Server Component
│       │   ├── OrdersManager.tsx   ← ✅ کلاینت (Realtime + فیلتر + مودال)
│       │   └── actions.ts          ← updateOrderStatus
│       ├── products/               ← مدیریت محصولات
│       ├── categories/             ← مدیریت دسته‌ها
│       ├── tables/
│       │   ├── page.tsx            ← Server Component
│       │   ├── TablesManager.tsx   ← ✅ کلاینت (QR Code + CRUD)
│       │   └── actions.ts          ← addTable/updateTable/deleteTable
│       ├── themes/                 ← تم‌ها (رنگ + فونت)
│       ├── quotes/                 ← جملات انگیزشی
│       └── settings/               ← تنظیمات کامل (لوگو، هدر، پس‌زمینه، اطلاعات تماس)
├── lib/
│   ├── menu-types.ts               ← ✅ همه type‌ها + DEFAULT_THEME
│   ├── cart-context.tsx            ← ✅ CartProvider + useCart + CartItem
│   ├── menu.ts                     ← ✅ getMenuData() + getSettings() (با React cache)
│   ├── site.ts                     ← ✅ SITE_URL
│   └── supabase/
│       ├── client.ts               ← ✅ supabaseBrowser()
│       └── server.ts               ← ✅ supabaseServer() (با cookies)
├── scripts/
│   ├── backup.mjs                  ← ✅ اسکریپت بکاپ (فقط فایل‌های سورس)
│   └── schedule-backup.mjs         ← ✅ بکاپ خودکار هر ۲۴ ساعت
├── middleware.ts                   ← محافظت از /admin
├── schema.sql                      ← ساختار دیتابیس
├── package.json
├── PROJECT_STATE.md                ← همین فایل
├── dev.bat                         ← ✅ منوی همه‌کاره توسعه (Interactive)
├── end-of-day.bat                  ← ✅ اسکریپت پایان روز (بکاپ + pull + push)
├── .gitignore                      ← ✅ نادیده گرفتن فایل‌های اضافی
└── backups/                        ← پوشه بکاپ‌ها (git ignore)
    └── YYYY-MM-DD/
        └── cafe-park_YYYY-MM-DD_HH-MM.zip
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

⚠️ **توجه:** رنگ‌های تم مشتری از دیتابیس (جدول `themes`) می‌آیند. رنگ‌های ادمین hardcode شده‌اند در `globals.css`.

### فونت‌ها:
- **پیش‌فرض:** `Vazirmatn` (از `next/font`، متغیر `--font-vazir`)
- **سفارشی:** از دیتابیس (جدول `themes`، فیلد `font_metadata`) با `@font-face` داینامیک

### کلاس‌های کلیدی (حتماً در JSX استفاده شوند):

**پنل ادمین:**
- `.admin-shell` / `.admin-sidebar` / `.admin-main` / `.admin-mobile-nav`
- `.admin-header` (h1 + subtitle)
- `.admin-card` (کارت پایه)
- `.btn` / `.btn.primary-btn` / `.btn.danger`
- `.field` / `.field-wide` / `.form-grid`
- `.info-card` / `.info-row`

**کارت‌های سفارش:**
- `.orders-grid` (کانتینر)
- `.order-card` / `.order-header` / `.order-id` / `.order-time`
- `.order-body` / `.order-actions`
- `.btn-approve` / `.btn-cancel`

**مودال‌ها:**
- عمومی: `.modal-overlay` / `.modal-container` / `.modal-header` / `.modal-body` / `.modal-footer` / `.modal-close-btn`
- محصول: `.product-modal-overlay` / `.product-modal` / `.product-modal-image` / `.product-modal-body`

**منوی مشتری:**
- `.theme-root` / `.hero` / `.hero-bg` / `.hero-content`
- `.sticky-head` / `.toolbar` / `.search-box` / `.cats` / `.cat`
- `.grid` / `.product` / `.photo` / `.product-info` / `.name` / `.desc` / `.meta` / `.price`
- `.cart-floating-bar` / `.cart-floating-btn`

**سبد و ثبت سفارش:**
- سبد: `.cart-page` / `.cart-item` / `.qty-selector` / `.cart-summary` / `.cart-actions` / `.cart-confirm-overlay`
- ثبت: `.checkout-page` / `.checkout-card` / `.checkout-field` / `.checkout-btn` / `.checkout-error`

**صفحه جزئیات سفارش:**
- `.order-detail-container` / `.status-stepper` / `.step-item` / `.step-dot`
- `.info-card` / `.info-row` / `.total-row` / `.sticky-action-bar` / `.btn-whatsapp`

### شماره‌گذاری بخش‌های `globals.css`:
| بخش | عنوان |
|---|---|
| 1 | RESET & BASE |
| 2-10 | PUBLIC MENU (Hero, Toolbar, Categories, Grid, Footer) |
| 11-13 | ADMIN SHELL + BASE + MOBILE NAV |
| 14-17 | ADMIN DASHBOARD + PRODUCTS + CATEGORIES |
| 18-21 | ADMIN QUOTES + SETTINGS + THEMES |
| 22-27 | MODAL + IMAGE/FONT UPLOAD + ICON PICKER |
| 28-32 | CATEGORY ICONS + PUBLIC MENU POLISH + ALL MENU SHEET |
| 33-36 | ADMIN LOGIN + SETTINGS + HERO IMAGE + CONTACT |
| 37 | **ADMIN ORDERS LIST** |
| 38 | **ORDER DETAILS PAGE** |
| 39 | **ADMIN TABLES** |
| 40 | **PRODUCT MODAL + CART BAR + BADGES** |
| 41 | **CART PAGE** |
| 42 | **CHECKOUT PAGE** |

---

## ✅ ۴. کارهای انجام‌شده

### منوی مشتری
- [x] صفحه اصلی با هدر داینامیک (لوگو، عنوان، زیرعنوان، اطلاعات تماس)
- [x] جستجوی فارسی (نرمال‌سازی ي/ك، ارقام، نیم‌فاصله)
- [x] فیلتر «پیشنهاد کافه» + فیلتر دسته‌بندی (Sticky)
- [x] شیت «کل منو» (Bottom Sheet روی موبایل)
- [x] کارت محصول با عکس، قیمت، اندازه، بج‌ها (پیشنهاد، جدید، ناموجود)
- [x] مودال جزئیات محصول (توضیحات، مواد، آلرژن، رژیمی، تنوع‌ها، تعداد)
- [x] ارسال به سبد + نوار شناور سبد
- [x] صفحه سبد خرید `/cart`
- [x] صفحه ثبت سفارش `/checkout` + ارسال به `/api/orders`
- [x] صفحه جزئیات سفارش مشتری `/order/[id]` با استپر وضعیت + polling هر ۱۰ ثانیه
- [x] ارسال سفارش به واتساپ

### پنل ادمین
- [x] Layout با سایدبار دسکتاپ + منوی پایین موبایل (۶ آیتم)
- [x] صفحه لاگین + middleware محافظ
- [x] داشبورد با آمار
- [x] مدیریت سفارش‌ها + Realtime + فیلترها (جدید/در جریان/تمام‌شده/همه)
- [x] تغییر وضعیت سفارش (pending → confirmed → preparing → ready → delivered)
- [x] مدیریت محصولات (CRUD + تنوع‌ها + عکس + آپلود)
- [x] مدیریت دسته‌ها (CRUD + آیکون)
- [x] مدیریت میزها + QR Code + دانلود PNG
- [x] مدیریت تم‌ها (رنگ + فونت + آپلود فونت)
- [x] مدیریت جملات
- [x] تنظیمات کامل (هدر، پس‌زمینه، اطلاعات تماس، لوگو، جای نمایش هر آیتم)

### زیرساخت و ابزارها
- [x] سیستم تم داینامیک از دیتابیس
- [x] Supabase Server + Browser Client
- [x] Cart Context با localStorage
- [x] اسکریپت بکاپ `scripts/backup.mjs`
- [x] اسکریپت بکاپ خودکار `scripts/schedule-backup.mjs`
- [x] `dev.bat` — منوی همه‌کاره توسعه (۱۶ گزینه)
- [x] `end-of-day.bat` — اسکریپت پایان روز (۵ مرحله)
- [x] `PROJECT_STATE.md` — سند زنده پروژه
- [x] `.gitignore` — نادیده گرفتن `node_modules`, `.next`, `.env.local`, `backups`

### رفع باگ‌ها
- [x] رفع بزرگ شدن عکس محصول در مودال (بخش ۴۰)
- [x] رفع به‌هم‌ریختگی صفحه سبد خرید (بخش ۴۱)
- [x] رفع به‌هم‌ریختگی صفحه ثبت سفارش (بخش ۴۲)
- [x] رفع به‌هم‌ریختگی صفحه مدیریت میزها (بخش ۳۹)
- [x] رفع به‌هم‌ریختگی لیست سفارش‌های ادمین (بخش ۳۷)
- [x] رفع به‌هم‌ریختگی صفحه جزئیات سفارش (بخش ۳۸)
- [x] رفع باگ بکاپ دوبل در `backup.mjs --clean`
- [x] رفع مشکل Git (pull --rebase قبل از push)

---

## 🚧 ۵. کارهای باقی‌مانده

> اولویت‌ها: 🔴 بالا / 🟡 متوسط / 🟢 پایین

- [ ] 🔴 **تست کامل روی موبایل واقعی** (iOS Safari + Chrome Android)
- [ ] 🔴 **تست کامل جریان سفارش** (ثبت → تأیید → آماده‌سازی → آماده → تحویل)
- [ ] 🔴 **تست Realtime** (باز کردن دو تب همزمان، ثبت سفارش از یکی، دیدن فوری در دیگری)
- [ ] 🟡 **دکمه چاپ فاکتور** در صفحه جزئیات سفارش ادمین
- [ ] 🟡 **PWA** (قابل نصب روی موبایل با `next-pwa`)
- [ ] 🟡 **بهبود SEO** (OpenGraph داینامیک، Twitter Card، Sitemap، robots.txt)
- [ ] 🟡 **پاکسازی سفارش‌های قدیمی** (بیشتر از ۳۰ روز) — Cron job در Supabase
- [ ] 🟡 **دکمه لغو سفارش برای مشتری** (تا زمانی که تأیید نشده)
- [ ] 🟢 **ایمیل/SMS اطلاع‌رسانی** برای سفارش‌های جدید
- [ ] 🟢 **تست بار (Load Test)** روی Supabase Realtime
- [ ] 🟢 **آمار فروش** در داشبورد ادمین (نمودار روزانه/هفتگی)
- [ ] 🟢 **حالت شبانه (Dark Mode)** برای پنل ادمین
- [ ] 🟢 **کد تخفیف / کوپن** برای مشتری‌ها

---

## 🔑 ۶. قوانین طلایی کدنویسی

1. 🚨 **هر کلاس جدید در JSX باید حتماً در `globals.css` تعریف شود.** (بزرگ‌ترین اشتباه این پروژه)
2. **نام کلاس‌ها با BEM-like:** `block-element` یا `block-element-modifier`
3. **هیچ استایل inline نداشته باشیم**، مگر برای مقادیر داینامیک از theme (مثل `style={{ '--primary-color': ... }}`)
4. **همه چیز از پالت رنگ بخش ۳ استفاده کند** — هیچ رنگ hex جدیدی خارج از این پالت
5. **روی موبایل تست شود** — breakpoint‌ها: `650px`, `768px`, `640px`
6. **برای همه مودال‌ها از `modal-overlay` + `modal-container` استفاده شود**
7. **قبل از ارسال به چت جدید، فایل `PROJECT_STATE.md` را پیوست کن.**
8. **بعد از هر تغییر مهم، `globals.css` را با `Ctrl+Shift+R` رفرش کن.**
9. **همه متن‌های `.bat` به انگلیسی + ایموجی باشند** (CMD فارسی را RTL رندر نمی‌کند).
10. **برای import داخل سرور از `supabaseServer()`، برای کلاینت از `supabaseBrowser()` استفاده شود.**

---

## 📝 ۷. متن آماده برای شروع چت جدید

> هر بار که می‌خواهی چت جدید بزنی، این متن را کپی کن و فایل `PROJECT_STATE.md` را ضمیمه کن:

```
سلام. من روی پروژه «کافه پارک» (Next.js + Supabase + globals.css) کار می‌کنم.
فایل PROJECT_STATE.md وضعیت کامل پروژه، سیستم طراحی، کلاس‌های CSS و کارهای باقی‌مانده را توضیح می‌دهد.
لطفاً قبل از هر کاری، این فایل را کامل بخوان و بر اساس آن ادامه بده.

⚠️ قوانین حیاتی:
1. تمام استایل‌ها فقط در app/globals.css هستند (بدون Tailwind).
2. هر کلاس جدیدی که در JSX استفاده می‌شود، باید در globals.css تعریف شود.
3. پالت رنگ از متغیرهای CSS می‌آید، نه رنگ hex مستقیم.
4. مودال‌ها از کلاس‌های modal-overlay + modal-container استفاده کنند.

📁 ابزارهای موجود در پروژه:
- dev.bat → منوی همه‌کاره توسعه (۱۶ گزینه)
- end-of-day.bat → اسکریپت پایان روز (بکاپ + pull + push)
- scripts/backup.mjs → اسکریپت بکاپ (npm run backup)
- scripts/schedule-backup.mjs → بکاپ خودکار هر ۲۴ ساعت

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
| 1405/07/19 | رفع به‌هم‌ریختگی صفحه جزئیات سفارش (بخش ۳۸) |
| 1405/07/19 | رفع به‌هم‌ریختگی لیست سفارش‌های ادمین (بخش ۳۷) |
| 1405/07/19 | رفع به‌هم‌ریختگی صفحه مدیریت میزها (بخش ۳۹) |
| 1405/07/19 | رفع بزرگ شدن عکس محصول در مودال (بخش ۴۰) |
| 1405/07/19 | رفع به‌هم‌ریختگی صفحه سبد خرید (بخش ۴۱) |
| 1405/07/19 | رفع به‌هم‌ریختگی صفحه ثبت سفارش (بخش ۴۲) |
| 1405/07/19 | ایجاد PROJECT_STATE.md + scripts/backup.mjs + scripts/schedule-backup.mjs |
| 1405/07/19 | افزودن dev.bat + end-of-day.bat (UI انگلیسی + ایموجی) |
| 1405/07/19 | رفع باگ بکاپ دوبل در backup.mjs --clean |
| 1405/07/19 | رفع مشکل Git (pull --rebase قبل از push) |

---

## 🔗 ۹. دستورات مهم (Quick Reference)

### اسکریپت‌های npm:
```bash
npm run dev               # اجرای پروژه در حالت توسعه
npm run build             # بیلد گرفتن
npm start                 # اجرای نسخه Build شده
npm run lint              # اجرای Linter
npm run backup            # بکاپ دستی
npm run backup:clean      # فقط پاکسازی بکاپ‌های قدیمی
npm run backup:schedule   # بکاپ خودکار هر ۲۴ ساعت
```

### فایل‌های `.bat`:
```bash
dev.bat                   # منوی همه‌کاره توسعه (دوبار کلیک)
end-of-day.bat            # اسکریپت پایان روز (دوبار کلیک)
```

### Git:
```bash
# قبل از push (برای جلوگیری از conflict)
git pull origin main --rebase --autostash

# ارسال تغییرات
git add . && git commit -m "پیام" && git push origin main
```

### متغیرهای محیطی (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # فقط برای عملیات سروری حساس
NEXT_PUBLIC_SITE_URL=https://cafe-park-menu.vercel.app   # اختیاری
```

---

## 💾 ۱۰. سیستم بکاپ

### ساختار پوشه بکاپ:
```
backups/
└── 2026-10-11/
    ├── cafe-park_2026-10-11_09-25.zip
    └── cafe-park_2026-10-11_09-50.zip
```

### ویژگی‌ها:
- فایل‌های سورس (tsx, ts, css, json, md, sql, env, ...) کپی می‌شوند
- `node_modules`, `.next`, `.git`, `backups` نادیده گرفته می‌شوند
- هر بکاپ به zip تبدیل می‌شود (~0.7MB)
- بکاپ‌های بیشتر از ۳۰ روز خودکار پاک می‌شوند (با `--clean`)

### اسکریپت‌های مرتبط:
| اسکریپت | کاربرد |
|---|---|
| `scripts/backup.mjs` | بکاپ کامل (فایل + zip) |
| `scripts/backup.mjs --clean` | فقط پاکسازی بکاپ‌های قدیمی |
| `scripts/backup.mjs --files` | فقط کپی فایل‌ها بدون zip |
| `scripts/schedule-backup.mjs` | اجرای خودکار هر ۲۴ ساعت (باید ترمینال باز بماند) |

---

## 🗄️ ۱۱. جداول دیتابیس (Supabase)

| جدول | کاربرد | فیلدهای کلیدی |
|---|---|---|
| `categories` | دسته‌بندی محصولات | `id`, `name`, `icon`, `sort_order`, `is_active` |
| `products` | محصولات | `id`, `category_id`, `name`, `price`, `image_url`, `is_featured`, `is_new`, `is_available`, `size`, `calories`, `prep_time_minutes`, `ingredients`, `allergens`, `dietary_info` |
| `variant_groups` | گروه‌های تنوع محصول (نوع سرو، سایز) | `id`, `product_id`, `name`, `is_required`, `sort_order` |
| `variant_options` | گزینه‌های هر گروه | `id`, `group_id`, `name`, `price_modifier`, `is_default`, `is_available`, `sort_order` |
| `orders` | سفارش‌ها | `id`, `order_number`, `customer_name`, `customer_phone`, `table_number`, `note`, `items` (JSONB), `subtotal`, `status`, `created_at`, `confirmed_at`, `preparing_at`, `ready_at`, `delivered_at`, `cancelled_at` |
| `tables` | میزها | `id`, `number`, `name`, `description`, `capacity`, `location` (indoor/outdoor/terrace/vip), `sort_order`, `is_active`, `qr_token` |
| `quotes` | جملات انگیزشی | `id`, `text`, `author`, `is_active` |
| `themes` | تم‌ها | رنگ‌ها (primary/secondary/background/surface/text/muted/accent)، font_url‌ها (regular/medium/semibold/bold/extrabold/black)، `font_metadata` (JSONB)، `border_radius`, `is_active` |
| `settings` | تنظیمات سایت (تک‌ردیفی، id=1) | `cafe_name`, `tagline`, `hero_*`, `footer_text`, `address`, `phone`, `instagram`, `working_hours`, `logo_url`, `maps_url`, `og_*`, `show_*` (نمایش/مخفی)، `*_in_header/footer/floating` |

### وضعیت سفارش‌ها (status):
```
pending    → confirmed  → preparing → ready → delivered
           ↘ cancelled
```

---

## 🛠️ ۱۲. ابزارهای توسعه

| ابزار | مسیر | کاربرد |
|---|---|---|
| **منوی توسعه** | `dev.bat` | منوی ۱۶ گزینه‌ای (dev، build، backup، git، VS Code، ...) |
| **پایان روز** | `end-of-day.bat` | بکاپ + پاکسازی + pull + push + باز کردن PROJECT_STATE.md |
| **بکاپ** | `scripts/backup.mjs` | اسکریپت اصلی بکاپ (فقط سورس، بدون node_modules) |
| **بکاپ خودکار** | `scripts/schedule-backup.mjs` | اجرای بکاپ هر ۲۴ ساعت (باید ترمینال باز بماند) |

---

## 📦 ۱۳. نسخه‌های نصب‌شده (package.json)

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

## 📄 ۱۴. `.gitignore` فعلی

```
node_modules/
.next/
.env
.env.local
.env.*.local
*.lnk

# بکاپ‌های محلی
backups/
```

---

## 🐛 ۱۵. باگ‌های شناخته‌شده

> هیچ باگ باز فعلاً وجود ندارد. باگ‌های جدید را اینجا اضافه کن.

| تاریخ | توضیح | وضعیت |
|---|---|---|
| — | — | — |

---

## 💡 ۱۶. تصمیمات فنی مهم

1. **بدون Tailwind:** تمام استایل‌ها در `globals.css` برای سادگی و کنترل کامل.
2. **Realtime Supabase:** برای آپدیت لحظه‌ای لیست سفارش‌ها در ادمین.
3. **Polling در صفحه جزئیات سفارش مشتری:** هر ۱۰ ثانیه (سبک‌تر از Realtime برای این کاربرد).
4. **QR Token برای میزها:** با اسکن QR، `?table=N` به URL اضافه می‌شود.
5. **فونت داینامیک از دیتابیس:** ادمین می‌تواند فونت سفارشی آپلود کند.
6. **localStorage برای سبد خرید:** بدون نیاز به ثبت‌نام.
7. **واتساپ به عنوان کانال اطلاع‌رسانی:** نیازی به پنل پیامکی نیست.
8. **متن‌های `.bat` به انگلیسی + ایموجی:** چون CMD فارسی RTL را درست رندر نمی‌کند.
9. **همه متن‌های `.bat` با `chcp 65001`:** برای پشتیبانی از UTF-8.
10. **در `end-of-day.bat` قبل از push، `git pull --rebase --autostash` اجرا می‌شود:** برای جلوگیری از conflict.