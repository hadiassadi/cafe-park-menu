# 📋 PROJECT_STATE.md — کافه پارک

> این فایل سند زنده پروژه است. هر بار که تغییری اعمال شد،
> بخش «۵. کارهای باقی‌مانده»، «۸. لاگ تغییرات» و «بالای فایل» رو آپدیت کن.
> در چت جدید، فقط همین فایل را برای AI پیوست کن.

**آخرین آپدیت:** ۱۴۰۵/۰۷/۲۹ (2026-10-21)

---

## 🎯 ۱. خلاصه پروژه

- **نام پکیج:** `cafe-park-menu` (پوشه پروژه: `Cofe-Park`)
- **تکنولوژی:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase + `globals.css` (بدون Tailwind)
- **هدف:** مشتری‌ها با اسکن QR روی میز، منو را باز می‌کنند، سفارش می‌دهند و از طریق واتساپ به کافه می‌فرستند. صاحب کافه هم از پنل ادمین، سفارش‌ها، منو، میزها، تم‌ها و تنظیمات را مدیریت می‌کند. مشتری‌ها می‌توانند بدون کد و فقط با شناسه دستگاه (کوکی امن)، سفارش‌های قبلی خود را ببینند. سیستم پرداخت چندگانه پیاده‌سازی شده است. همچنین مشتری‌ها می‌توانند Web Push Notification (اعلان مرورگر) را فعال کنند و در **باشگاه مشتریان سازمانی (B2B)** ثبت‌نام کنند تا تخفیف‌های اختصاصی (مثل دانشکده داروسازی) دریافت کنند.
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
│   ├── layout.tsx                  ← Root Layout (فونت + متادیتای SEO + نوار شناور)
│   ├── globals.css                 ← ✅ تنها فایل استایل پروژه (۹۴ بخش)
│   ├── manifest.ts                 ← PWA Manifest
│   ├── cart/page.tsx               ← صفحه سبد خرید (+ خواندن شماره میز از QR)
│   ├── checkout/page.tsx           ← صفحه ثبت سفارش + کوپن + انتخاب پرداخت (نقدی/کارت‌خوان ادغام شده)
│   ├── my-orders/                  ← ✅ پنل مشتری (بدون OTP)
│   │   ├── page.tsx
│   │   └── MyOrdersClient.tsx      ← تاریخچه + فرم ثبت‌نام باشگاه مشتریان
│   ├── order/[id]/                 ← جزئیات سفارش مشتری
│   │   ├── page.tsx                ← صفحه اصلی سفارش + وضعیت پرداخت + Push Card
│   │   └── UploadReceipt.tsx       ← ✅ آپلود رسید (عکس/متن + نمایش رسید قبلی + دکمه تغییر)
│   ├── api/
│   │   ├── admin/                  ← ✅ APIهای امن ادمین (مشتریان، لیست اعضا، حذف/ویرایش سازمان)
│   │   ├── orders/                 ← ✅ APIهای سفارش (ثبت با Salt هش شده)
│   │   ├── customer/               ← ✅ API پنل مشتری (me, orders, membership)
│   │   ├── payment/                ← ✅ API پرداخت (زرین‌پال)
│   │   ├── membership/             ← ✅ API باشگاه مشتریان (register, organizations, rules)
│   │   ├── push/                   ← ✅ APIهای Web Push Notification (subscribe, send)
│   │   └── upload-receipt/         ← آپلود به Storage
│   ├── components/                 
│   │   ├── EnablePushCard.tsx      ← ✅ کارت فعال‌سازی اعلان مرورگر
│   │   ├── CartFloatingBar.tsx     ← ✅ نوار شناور سبد
│   │   └── (بقیه کامپوننت‌ها)
│   └── admin/
│       ├── layout.tsx              ← هدر + drawer + اعلان
│       ├── memberships/            ← ✅ صفحه باشگاه مشتریان (آپلود اکسل، مدیریت سازمان‌ها)
│       ├── orders/                 ← مدیریت سفارش‌ها
│       └── (بقیه صفحات ادمین)
├── lib/
│   ├── menu-types.ts
│   ├── cart-context.tsx
│   ├── stats.ts
│   ├── push/
│   │   └── send-push.ts            ← ✅ تابع ارسال پوش با web-push
│   ├── utils/
│   │   └── hash.ts                 ← ✅ تابع هش کردن با Salt و نرمالایز فارسی
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

**🚨 قانون حیاتی:** تمام استایل‌ها فقط در `app/globals.css` هستند. **هیچ Tailwind و هیچ CSS Module وجود ندارد.** اگر کلاس جدیدی به JSX اضافه شد، **باید در `globals.css` هم تعریف شود** — در غیر این صورت صفحه به‌هم می‌ریزد.

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
| 1-39 | (بدون تغییر - منو، ادمین، مودال‌ها، سفارشات) |
| 40 | PRODUCT DETAIL MODAL + CART BAR + BADGES |
| 41 | CART PAGE |
| 42 | CHECKOUT PAGE |
| 43-78 | (بدون تغییر - گزارش‌ها، تنظیمات، دارک مود) |
| 79 | PAYMENT (انتخاب روش پرداخت) |
| 80 | ORDER PAYMENT (بخش پرداخت در صفحه سفارش) |
| 82 | RECEIPT UPLOAD (آپلود رسید) |
| 83-92 | (بدون تغییر - رنگ‌بندی ادمین، تب‌ها، گریدها) |
| 93 | ENABLE PUSH CARD (کارت فعال‌سازی اعلان) |
| 94 | MOBILE COMPACT HOMEPAGE (بهینه‌سازی موبایل) |

---

## ✅ ۴. کارهای انجام‌شده

### 🎓 باشگاه مشتریان سازمانی (B2B Loyalty)
- [x] **دیتابیس:** ساخت جداول `organizations`، `organization_members` (با هش)، `redemption_logs`، `membership_requests`.
- [x] **آپلود اکسل هوشمند:** صفحه `admin/memberships` برای آپلود اکسل با قابلیت تطبیق ستون‌ها، ویرایش تک‌تک سلول‌ها، و انتخاب تاریخ شمسی.
- [x] **مدیریت سازمان:** مشاهده لیست اعضا، ویرایش تنظیمات، غیرفعال‌سازی موقت و حذف کامل سازمان.
- [x] **ثبت‌نام مشتری:** فرم در `my-orders` با انتخاب سازمان از دراپ‌داون و فیلد مشروط شماره دانشجویی.
- [x] **قوانین پویا:** نمایش قوانین اختصاصی هر بخش (عادی/سازمانی) از دیتابیس در مودال ثبت‌نام.
- [x] **هش امن:** استفاده از `SHA-256` + Salt + نرمالایز فارسی برای تطبیق دقیق.

### 🔔 وب پوش (Web Push Notification)
- [x] پیاده‌سازی با `web-push`، VAPID Keys، Service Worker یکپارچه و کارت فعال‌سازی (`EnablePushCard`).
- [x] ارسال خودکار در تغییر وضعیت سفارش از پنل ادمین.

### 🎨 بهینه‌سازی UI و UX
- [x] **ادغام پرداخت حضوری:** «نقدی» و «کارت‌خوان» در UI به یک گزینه «پرداخت در محل» تبدیل شدند (دیتابیس هر دو را پشتیبانی می‌کند).
- [x] **بهینه‌سازی موبایل:** حذف بک‌گراند در موبایل، کوچک‌کردن هدر، و تبدیل گرید دسته‌ها به ۳ ستون (بخش ۹۴ در CSS).
- [x] **شماره میز خودکار:** خواندن `?table=N` از QR و نمایش بج در Cart و پر کردن خودکار در Checkout.
- [x] **نوار شناور سبد خرید:** همیشه در دسترس در تمام صفحات منو.

### 🔒 امنیت
- [x] قفل کامل RLS.
- [x] انتقال APIها به Service Role.
- [x] کوکی دستگاه (`cafe_device_token`) با `httpOnly`.
- [x] رفع باگ دوباره‌کاری هش دستگاه (استفاده از `hashData` در سفارش و عضویت).

---

## 🚧 ۵. کارهای باقی‌مانده

> اولویت‌ها: 🔴 بالا / 🟡 متوسط / 🟢 پایین

- [ ] 🔴 **اعمال خودکار تخفیف در Checkout:** محاسبه و کسر خودکار درصد تخفیف سازمانی در صفحه ثبت سفارش (با چک کردن `device_id_hash` و محدودیت‌های روزانه/کل).
- [ ] 🔴 **تست کامل جریان سفارش** از ابتدا تا انتها (با همه روش‌های پرداخت).
- [ ] 🟡 **اتصال ثبت‌نام باشگاه به سفارش:** وقتی کاربر ثبت‌نام می‌کند، به صورت خودکار در جدول `customers` هم با تگ مربوطه ثبت شود.
- [ ] 🟢 **ایمیل/SMS اطلاع‌رسانی:** برای تغییر وضعیت سفارش.
- [ ] 🟢 **اتصال به درگاه پرداخت‌های دیگر** (آیدی‌پی).
- [ ] 🟢 **تست بار (Load Test)** روی Supabase.

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

> هر بار که می‌خواهی چت جدید بزنی، این متن را کپی کن و فایل `PROJECT_STATE.md` را ضمیمه کن:

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
| 1405/07/19 | پیاده‌سازی پنل ادمین |
| 1405/07/19 | افزودن QR Code به میزها |
| 1405/07/20 | افزودن PWA + SEO + آمار داشبورد + لغو سفارش + پاکسازی |
| 1405/07/21 | افزودن سیستم کوپن + دارک مود + اعلان سفارش + تایتل داینامیک |
| 1405/07/22 | گزارش کوپن + PrintInvoice + خروجی CSV + CRM |
| 1405/07/23 | سیستم لغو + مودال جزئیات لغو |
| 1405/07/24 | آمار پیشرفته لغو + بازطراحی صفحات |
| 1405/07/25 | پاکسازی خودکار pg_cron |
| 1405/07/26 | گزارش فروش و مالیات |
| 1405/07/27 | فیلتر لغو در CRM + بازطراحی ناوبری موبایل |
| 1405/08/01 | پنل مشتری + PWA Badge |
| 1405/08/02 | سیستم پرداخت چندگانه + صفحه بازگشت از درگاه + آپلود رسید |
| 1405/08/03 | **بهینه‌سازی امنیتی بزرگ:** قفل RLS + Service Role + کوکی دستگاه |
| 1405/08/05 | **Quick Wins ۲:** QR میز، نوار شناور، رفع فیلدهای تکراری Checkout، پاکسازی CSS |
| 1405/08/06 | **Web Push Notification:** VAPID، جدول `push_subscriptions`، Service Worker، APIها، کارت UI و اتصال به ادمین |
| 1405/07/27 | **فاز باشگاه مشتریان:** جداول B2B، آپلود اکسل با ویرایش، ثبت‌نام مشتری، قوانین پویا، تقویم شمسی، حذف/ویرایش سازمان + ادغام پرداخت‌های حضوری + بهینه‌سازی UI موبایل |

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
| `settings` | تنظیمات سایت (id=1) | `cafe_name`, `hero_*`, `footer_text`, `address`, `phone`, `instagram`, `working_hours`, `payment_enabled`, `payment_online_enabled`, `payment_cash_enabled`, `payment_card_enabled`, `payment_transfer_enabled`, **`membership_rules_general`**, **`membership_rules_org`** |
| `coupons` | کدهای تخفیف | `id`, `code`, `discount_type`, `discount_value`, `min_order_amount`, `max_uses`, `used_count`, `valid_from`, `valid_until`, `is_active` |
| `customers` | مشتریان (CRM) | `phone`, `notes`, `tags`, `updated_at` |
| **`organizations`** | **تنظیمات کلی سازمان‌ها** | `id`, `name`, `discount_percent`, `max_daily_orders`, `max_total_orders`, `expires_at`, `is_active` |
| **`organization_members`** | **اعضای تایید شده سازمان‌ها** | `id`, `organization_id`, `full_name_hash`, `phone_hash`, `member_id_hash`, `device_id_hash`, `is_registered`, `metadata` |
| **`redemption_logs`** | **دفتر کل استفاده از تخفیف‌ها** | `id`, `member_id`, `order_id`, `created_at` |
| **`membership_requests`** | **درخواست‌های ناموفق برای بررسی ادمین** | `id`, `full_name`, `phone`, `member_id`, `organization_name`, `status` |
| **`push_subscriptions`** | **اشتراک‌های اعلان مرورگر** | `id`, `device_id_hash`, `endpoint`, `p256dh`, `auth`, `user_agent`, `is_active` |

---

## 📦 ۱۳. نسخه‌های نصب‌شده

### Dependencies:
```text
@supabase/ssr          ^0.5.2
@supabase/supabase-js  ^2.45.4
next                   ^16.3.8
react                  ^19.3.0
react-dom              ^19.3.0
web-push               ^3.6.7
xlsx                   ^0.18.5
react-multi-date-picker ^4.5.2
react-date-object      ^2.1.8
```

### DevDependencies:
```text
@types/react           ^19.0.0
@types/react-dom       ^19.0.0
@types/web-push        ^3.6.4
typescript             ^5.6.3
```

---

## 💡 ۱۶. تصمیمات فنی مهم

1-81. *(تصمیمات قبلی بدون تغییر)*
82. **معماری باشگاه مشتریان (Ledger Pattern):** برای سابقه استفاده از تخفیف‌ها از جدول `redemption_logs` استفاده می‌شود تا باگ Race Condition پیش نیاید.
83. **هش کردن داده‌های حساس:** نام و شماره دانشجویی با `SHA-256` + `Salt` هش می‌شوند. Salt در متغیر محیطی `HASH_SALT` است.
84. **نرمال‌سازی اطلاعات قبل از هش:** حروف عربی (ي، ك) به فارسی، نیم‌فاصله حذف و فاصله‌های اضافی اصلاح می‌شوند.
85. **پردازش اکسل سمت کلاینت:** خواندن فایل با `xlsx` در مرورگر انجام می‌شود تا ادمین بتواند قبل از ثبت، داده‌ها را ویرایش کند.
86. **ادغام پرداخت‌های حضوری:** روش‌های «نقدی» و «کارت‌خوان» در UI ادغام شدند.
87. **ریسپانسیو اختصاصی موبایل:** صفحه اصلی منو در موبایل با CSS بهینه شد (حذف بک‌گراند، هدر کوچک، گرید ۳ ستونه).
88. **تقویم شمسی:** استفاده از `react-multi-date-picker` برای انتخاب تاریخ انقضای قرارداد در پنل ادمین.