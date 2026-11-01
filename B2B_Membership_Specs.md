# 📋 PROJECT_STATE.md — کافه پارک

> این فایل سند زنده پروژه است. هر بار که تغییری اعمال شد،
> بخش «۵. کارهای باقی‌مانده»، «۸. لاگ تغییرات» و «بالای فایل» رو آپدیت کن.
> در چت جدید، فقط همین فایل را برای AI پیوست کن.

**آخرین آپدیت:** ۱۴۰۵/۰۸/۰۱ (2026-10-23)

---

## 🎯 ۱. خلاصه پروژه

- **نام پکیج:** `cafe-park-menu` (پوشه پروژه: `Cofe-Park`)
- **تکنولوژی:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase + `globals.css` (بدون Tailwind)
- **هدف:** مشتری‌ها با اسکن QR روی میز، منو را باز می‌کنند، سفارش می‌دهند و از طریق واتساپ به کافه می‌فرستند. صاحب کافه هم از پنل ادمین، سفارش‌ها، منو، میزها، تم‌ها و تنظیمات را مدیریت می‌کند. مشتری‌ها می‌توانند بدون کد و فقط با شناسه دستگاه (کوکی امن)، سفارش‌های قبلی خود را ببینند. سیستم پرداخت چندگانه پیاده‌سازی شده است. همچنین مشتری‌ها می‌توانند Web Push Notification (اعلان مرورگر) را فعال کنند و در **باشگاه مشتریان سازمانی (B2B)** ثبت‌نام کنند تا تخفیف‌های اختصاصی دریافت کنند.
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
│   ├── MenuClient.tsx              ← کلاینت منوی مشتری (+ نوار شناور سبد)
│   ├── layout.tsx                  ← Root Layout (فونت + متادیتای SEO)
│   ├── globals.css                 ← ✅ تنها فایل استایل پروژه (۹۴ بخش)
│   ├── cart/page.tsx               ← صفحه سبد خرید (+ QR Table)
│   ├── checkout/page.tsx           ← صفحه ثبت سفارش + کوپن + پرداخت + تخفیف باشگاه
│   ├── my-orders/                  ← ✅ پنل مشتری (داشبورد + تاریخچه + ثبت‌نام باشگاه)
│   ├── order/[id]/                 ← جزئیات سفارش + Push Card
│   ├── api/
│   │   ├── admin/memberships/      ← ✅ APIهای ادمین باشگاه (آپلود، تنظیمات، تایید درخواست)
│   │   ├── orders/                 ← ✅ ثبت سفارش (با اعمال تخفیف باشگاه)
│   │   ├── customer/               ← ✅ API پنل مشتری (me, orders)
│   │   ├── membership/             ← ✅ API باشگاه (register, calculate, organizations, rules)
│   │   ├── payment/                ← ✅ API پرداخت
│   │   ├── push/                   ← ✅ Web Push (subscribe, send)
│   │   └── upload-receipt/         ← آپلود به Storage
│   ├── components/                 
│   │   ├── EnablePushCard.tsx      ← ✅ کارت فعال‌سازی اعلان مرورگر
│   │   └── CartFloatingBar.tsx     ← ✅ نوار شناور سبد
│   └── admin/
│       ├── layout.tsx              ← هدر + drawer + اعلان
│       ├── memberships/            ← ✅ پنل مدیریت باشگاه مشتریان
│       ├── orders/                 ← مدیریت سفارش‌ها
│       └── (بقیه صفحات ادمین)
├── lib/
│   ├── menu-types.ts
│   ├── cart-context.tsx
│   ├── stats.ts
│   ├── push/send-push.ts           ← ✅ تابع ارسال پوش با web-push
│   ├── utils/hash.ts               ← ✅ تابع هش کردن با Salt و نرمالایز فارسی
│   └── supabase/
├── public/
│   ├── sw.js                       ← ✅ Service Worker (کش + دریافت پوش)
│   └── icons/
├── supabase/
│   └── cron-cleanup.sql
├── proxy.ts
└── dev.bat
```

---

## 🎨 ۳. سیستم طراحی (Design System)

**🚨 قانون حیاتی:** تمام استایل‌ها فقط در `app/globals.css` هستند. **هیچ Tailwind و هیچ CSS Module وجود ندارد.** هر کلاس جدید باید در `globals.css` تعریف شود.

### پالت رنگ اصلی:
| متغیر | مقدار پیش‌فرض | کاربرد |
|---|---|---|
| `--primary-color` | `#6b4f3a` | قهوه‌ای تیره (دکمه‌ها، تیترها) |
| `--accent-color` | `#9a6b3f` | قهوه‌ای روشن (قیمت‌ها) |
| `--background-color` | `#fffdf9` (theme) / `#f7f3eb` (ادمین) | کرم (پس‌زمینه) |
| `--surface-color` | `#ffffff` | کارت‌ها |
| `--text-color` | `#29251f` | خاکستری تیره |
| `--muted-text-color` | `#766f64` | خاکستری متوسط |
| **رنگ تخفیف / موفقیت** | `#2d5d3e` / `#477052` | متن تخفیف‌ها (سبز) |
| **رنگ کوپن غیرفعال / لغو / خطا** | `#9b3c32` | هشدارها، بج‌های منفی، لغو |
| **رنگ اعلان** | `#dc2626` / `#ef4444` (dark) | Badge و Alert سفارش جدید |

### شماره‌گذاری بخش‌های `globals.css`:
| بخش | عنوان |
|---|---|
| 1-39 | (منو، ادمین، مودال‌ها، سفارشات) |
| 40 | PRODUCT DETAIL MODAL + CART BAR + BADGES |
| 41 | CART PAGE |
| 42 | CHECKOUT PAGE |
| 43-78 | (گزارش‌ها، تنظیمات، دارک مود) |
| 79 | PAYMENT (انتخاب روش پرداخت) |
| 80 | ORDER PAYMENT (بخش پرداخت در صفحه سفارش) |
| 82 | RECEIPT UPLOAD (آپلود رسید) |
| 83-92 | (رنگ‌بندی ادمین، تب‌ها، گریدها) |
| 93 | ENABLE PUSH CARD (کارت فعال‌سازی اعلان) |
| 94 | MOBILE COMPACT HOMEPAGE (بهینه‌سازی موبایل) |

---

## ✅ ۴. کارهای انجام‌شده

### 🎓 باشگاه مشتریان سازمانی (B2B Loyalty)
- [x] **دیتابیس:** جداول `organizations`، `organization_members` (با هش)، `redemption_logs`، `membership_requests`.
- [x] **آپلود اکسل:** با قابلیت تطبیق ستون‌ها (Column Mapping) و ویرایش تک‌تک سلول‌ها قبل از ثبت.
- [x] **مدیریت سازمان:** مشاهده لیست اعضا، ویرایش تنظیمات (تخفیف، سقف، تاریخ با تقویم شمسی)، حذف کامل.
- [x] **ثبت‌نام مشتری:** با دراپ‌داون انتخاب سازمان، فیلد مشروط شماره دانشجویی، و نمایش قوانین پویا.
- [x] **هش امن:** استفاده از `SHA-256` + Salt + نرمالایز فارسی برای تطبیق دقیق.
- [x] **پنل ادمین کامل:** ویرایش قوانین، تایید/رد درخواست‌های دستی، مشاهده اعضای عادی و سازمانی.
- [x] **اعمال تخفیف در Checkout:** کسر خودکار تخفیف، نمایش آیتم‌های شامل/غیرشامل تخفیف، خط خوردن مبلغ اولیه، و ثبت در `redemption_logs`.
- [x] **داشبورد مشتری:** نمایش «خوش اومدی»، آمار (کل سفارشات، مجموع خرید، تخفیفات) و بنر سبزِ هوشمند برای مشتری عادی/سازمانی.

### 🔔 وب پوش (Web Push Notification)
- [x] پیاده‌سازی با `web-push`، VAPID Keys، Service Worker یکپارچه و کارت فعال‌سازی.
- [x] ارسال خودکار در تغییر وضعیت سفارش از پنل ادمین.

### 🎨 بهینه‌سازی UI و UX
- [x] **ادغام پرداخت حضوری:** «نقدی» و «کارت‌خوان» در UI به یک گزینه «پرداخت در محل» تبدیل شدند.
- [x] **بهینه‌سازی موبایل:** حذف بک‌گراند در موبایل، کوچک‌کردن هدر، و تبدیل گرید دسته‌ها به ۳ ستون.
- [x] **شماره میز خودکار:** خواندن `?table=N` از QR و پر کردن خودکار در Checkout.
- [x] **نوار شناور سبد خرید:** همیشه در دسترس در تمام صفحات منو.

### 🔒 امنیت
- [x] قفل کامل RLS.
- [x] انتقال APIها به Service Role.
- [x] کوکی دستگاه (`cafe_device_token`) با `httpOnly`.
- [x] جلوگیری از ثبت‌نام تکراری (با چک کردن شماره تلفن و شماره دانشجویی).

---

## 🚧 ۵. کارهای باقی‌مانده

> اولویت‌ها: 🔴 بالا / 🟡 متوسط / 🟢 پایین

- [ ] 🔴 **تست کامل روی موبایل واقعی** (End-to-End از ثبت‌نام تا سفارش).
- [ ] 🟡 **اتصال ثبت‌نام باشگاه به CRM:** وقتی کاربر ثبت‌نام می‌کند، به صورت خودکار در جدول `customers` با تگ مربوطه ثبت شود.
- [ ] 🟢 **ایمیل/SMS اطلاع‌رسانی:** برای تغییر وضعیت سفارش.
- [ ] 🟢 **اتصال به درگاه پرداخت‌های دیگر** (آیدی‌پی).
- [ ] 🟢 **تست بار (Load Test)** روی Supabase.
- [ ] 🟢 **پنل اختصاصی مشتری (Login):** برای دسترسی به تاریخچه از هر دستگاهی (نه فقط دستگاه ثبت‌نام).

---

## 🔑 ۶. قوانین طلایی کدنویسی

1. 🚨 **هر کلاس جدید در JSX باید حتماً در `globals.css` تعریف شود.**
2. **نام کلاس‌ها با BEM-like.**
3. **هیچ استایل inline نداشته باشیم** (مگر مقادیر داینامیک).
4. **پالت رنگ از متغیرهای CSS.**
5. **تست روی موبایل** (breakpoints: 650, 768, 640, 500).
6. **مودال‌ها با `modal-overlay` + `modal-container`.**
7. **قبل از چت جدید `PROJECT_STATE.md` پیوست شود.**
8. **بعد از تغییر `Ctrl+Shift+R`.**
9. **متن‌های `.bat` انگلیسی + ایموجی.**
10. **سرور: `SERVICE_ROLE_KEY` / کلاینت: `supabaseBrowser()`.**
11. **در کوئری‌ها ستون‌های جدید به `select` اضافه شوند.**
12. **اعلان‌ها با Polling (نه Realtime).**
13. **در fetchها از `cache: 'no-store'`.**
14. **جستجوی چندفرمتی شماره.**
15. **عملیات حساس با API Route مخفی.**
16. **فایل‌های سروری `import 'server-only'` داشته باشند.**
17. **استفاده از `supabaseAdmin()` در سرور.**
18. **پراپ‌های کامپوننت در `type Props`.**
19. **بعد از پاکسازی CSS، `npm run build` بزن.**
20. **برای هش کردن اطلاعات حتماً از `hashData` در `lib/utils/hash.ts` استفاده شود.**

---

## 📝 ۷. متن آماده برای شروع چت جدید

```text
سلام. من روی پروژه «کافه پارک» (Next.js 16 + Supabase + globals.css) کار می‌کنم.
فایل PROJECT_STATE.md وضعیت کامل پروژه، سیستم طراحی، کلاس‌های CSS و کارهای باقی‌مانده را توضیح می‌دهد.
لطفاً قبل از هر کاری، این فایل را کامل بخوان و بر اساس آن ادامه بده.

⚠️ قوانین حیاتی:
1. تمام استایل‌ها فقط در app/globals.css هستند (بدون Tailwind).
2. هر کلاس جدیدی که در JSX استفاده می‌شود، باید در globals.css تعریف شود.
3. پالت رنگ از متغیرهای CSS می‌آید.
4. مودال‌ها از کلاس‌های modal-overlay + modal-container استفاده کنند.
5. برای اعلان‌ها از Polling استفاده شود، نه Realtime.
6. محافظت ادمین با proxy.ts.
7. در fetch های API از cache: 'no-store' استفاده شود.
8. همه APIهای حساس باید از SERVICE_ROLE_KEY استفاده کنند.
9. هر پراپ جدید کامپوننت باید در `type Props` تعریف شود.
10. بعد از هر پاکسازی CSS، `npm run build` بزن.
11. تمام هش‌ها باید از `hashData` در `lib/utils/hash.ts` استفاده کنند.

📁 ابزارهای موجود در پروژه:
- dev.bat / end-of-day.bat
- npm run backup
- Web Push (VAPID)
- xlsx (برای آپلود اکسل)
- react-multi-date-picker (تقویم شمسی)

درخواست فعلی من:
[اینجا درخواستت را بنویس]
```

---

## 📅 ۸. لاگ تغییرات

| تاریخ | تغییر |
|---|---|
| 1405/07/19 | پیاده‌سازی کامل منوی مشتری + سبد خرید + ثبت سفارش |
| 1405/07/20 | افزودن PWA + SEO + آمار داشبورد + لغو سفارش + پاکسازی |
| 1405/07/21 | سیستم کوپن + دارک مود + اعلان سفارش + تایتل داینامیک |
| 1405/07/22 | گزارش کوپن + PrintInvoice + خروجی CSV + CRM |
| 1405/07/23 | سیستم لغو + مودال جزئیات لغو |
| 1405/07/24 | آمار پیشرفته لغو + بازطراحی صفحات |
| 1405/07/25 | پاکسازی خودکار pg_cron |
| 1405/07/26 | گزارش فروش و مالیات |
| 1405/07/27 | فیلتر لغو در CRM + بازطراحی ناوبری موبایل |
| 1405/08/01 | **فاز بزرگ باشگاه مشتریان B2B:** جداول جدید، آپلود اکسل، هش امن، فرم ثبت‌نام، پنل مدیریت باشگاه، اعمال تخفیف در Checkout، و داشبورد مشتری. + ادغام پرداخت‌های حضوری + بهینه‌سازی UI موبایل. |

---

## 🔗 ۹. دستورات مهم (Quick Reference)

### اسکریپت‌های npm:
```bash
npm run dev               # اجرای پروژه در حالت توسعه
npm run build             # بیلد گرفتن
npm start                 # اجرای نسخه Build شده
npm run backup            # بکاپ لوکال
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
VAPID_PUBLIC_KEY=BEl62iUYgUivx...
VAPID_PRIVATE_KEY=UUxI4O8-Fb...
VAPID_SUBJECT=mailto:hadiassadi@gmail.com
HASH_SALT=cp_9f8e7d6c5b4a3210fedcba9876543210_secret_1405
```

---

## 🗄️ ۱۱. جداول دیتابیس (Supabase)

| جدول | کاربرد | فیلدهای کلیدی |
|---|---|---|
| `categories` | دسته‌بندی محصولات | `id`, `name`, `icon`, `sort_order`, `is_active`, `coupon_eligible` |
| `products` | محصولات | `id`, `category_id`, `name`, `price`, `image_url`, `is_featured`, `is_new`, `is_available`, `size`, `coupon_eligible` |
| `orders` | سفارش‌ها | `id`, `order_number`, `customer_name`, `customer_phone`, `table_number`, `note`, `items` (JSONB), `subtotal`, `status`, `coupon_code`, `coupon_discount`, `payment_method`, `payment_status`, `payment_receipt_url`, **`device_id_hash`**, `created_at` |
| `tables` | میزها | `id`, `number`, `name`, `description`, `capacity`, `location`, `sort_order`, `is_active`, `qr_token` |
| `settings` | تنظیمات سایت (id=1) | `cafe_name`, `hero_*`, `footer_text`, `address`, `phone`, `instagram`, `working_hours`, `payment_enabled`, **`membership_rules_general`**, **`membership_rules_org`** |
| `coupons` | کدهای تخفیف | `id`, `code`, `discount_type`, `discount_value`, `min_order_amount`, `max_uses`, `used_count`, `valid_from`, `valid_until`, `is_active` |
| `customers` | مشتریان (CRM) | `phone`, `name`, `notes`, `tags`, `device_id_hash`, `updated_at` |
| **`organizations`** | **تنظیمات کلی سازمان‌ها** | `id`, `name`, `discount_percent`, `max_daily_orders`, `max_total_orders`, `expires_at`, `is_active` |
| **`organization_members`** | **اعضای تایید شده سازمان‌ها** | `id`, `organization_id`, `full_name_hash`, `phone_hash`, `member_id_hash`, `device_id_hash`, `is_registered`, `metadata` |
| **`redemption_logs`** | **دفتر کل استفاده از تخفیف‌ها** | `id`, `member_id`, `order_id`, `created_at` |
| **`membership_requests`** | **درخواست‌های ناموفق** | `id`, `full_name`, `phone`, `member_id`, `organization_name`, `status` |
| **`push_subscriptions`** | **اشتراک‌های اعلان مرورگر** | `id`, `device_id_hash`, `endpoint`, `p256dh`, `auth`, `user_agent`, `is_active` |

---

## 💡 ۱۶. تصمیمات فنی مهم

1-81. *(تصمیمات قبلی بدون تغییر)*
82. **معماری باشگاه مشتریان (Ledger Pattern):** برای سابقه استفاده از تخفیف‌ها از جدول `redemption_logs` استفاده می‌شود تا باگ Race Condition پیش نیاید.
83. **هش کردن داده‌های حساس:** نام و شماره دانشجویی با `SHA-256` + `Salt` هش می‌شوند. Salt در متغیر محیطی `HASH_SALT` است.
84. **نرمال‌سازی اطلاعات قبل از هش:** حروف عربی (ي، ك) به فارسی، نیم‌فاصله حذف و فاصله‌های اضافی اصلاح می‌شوند.
85. **پردازش اکسل سمت کلاینت:** خواندن فایل با `xlsx` در مرورگر انجام می‌شود تا ادمین بتواند قبل از ثبت، داده‌ها را ویرایش کند.
86. **ادغام پرداخت‌های حضوری:** روش‌های «نقدی» و «کارت‌خوان» در UI ادغام شدند.
87. **ریسپانسیو اختصاصی موبایل:** صفحه اصلی منو در موبایل با CSS بهینه شد (حذف بک‌گرند، هدر کوچک، گرید ۳ ستونه).
88. **تقویم شمسی:** استفاده از `react-multi-date-picker` برای انتخاب تاریخ انقضای قرارداد در پنل ادمین.
89. **جلوگیری از ثبت‌نام تکراری:** هر شماره تلفن یا شماره دانشجویی فقط یک بار می‌تواند ثبت‌نام کند. سیستم با چک کردن دیتابیس، از ثبت‌نام مجدد با دستگاه‌های دیگر جلوگیری می‌کند.