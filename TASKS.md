# 📋 TASKS — کافه پارک

> فقط چک‌لیست. تیک‌زدن = تغییر `[ ]` به `[x]` و انتقال خط به بخش «انجام‌شده».
> آخرین به‌روزرسانی: ۱۴۰۵/۰۸/۱۰

## 🔄 در حال انجام
- [ ] صفحهٔ `/admin/orders/new` (سفارش حضوری)

## ⏳ انجام‌نشده

### 🔴 فوری
- [ ] ادغام `harden-hash-salt` (اول `HASH_SALT` در Vercel)
- [ ] بارگذاری مجدد لیست اعضای باشگاه بعد از ادغام هش
- [ ] تأیید شمارهٔ مشتریان واقعی (مودال مشتری)
- [ ] حذف `reset_test_data`
- [ ] فعال‌کردن Leaked Password Protection

### 🔴 امنیت
- [ ] مالکیت سفارش: `orders/[id]`، `cancel`، `customer-confirm`، `set-method`
- [ ] RPC اتمیک باشگاه + `unique(order_id)` در `redemption_logs`
- [ ] برگشت سهمیه هنگام لغو
- [ ] تخفیف باشگاه فقط سروری
- [ ] تست Actionهای ادمین بعد از logout
- [ ] بررسی دسترسی `cancel_order_by_customer`

### 🟠 سفارش حضوری
- [ ] تسویه با `add_order_payment` / `set_order_payment_status`
- [ ] کلاس‌های CSS صفحه در `globals.css`
- [ ] لینک در منوی ادمین
- [ ] یکدست‌کردن `createAdminDb()` به `supabaseAdmin()`
- [ ] merge شاخهٔ `feature-walkin-orders`
- [ ] لغو دو سفارش تستی

### 🟠 منطق و پرداخت
- [ ] حذف رسید از Storage پس از رد
- [ ] Rate Limiting: `upload-receipt`، `payment/request`، `membership/*`
- [ ] تست رد رسید برای سفارش با پرداخت تأییدشده
- [ ] ترکیب تخفیف باشگاه و کوپن (تصمیم ۹۳)
- [ ] تست کوپن و زرین‌پال (sandbox)

### 🟡 سخت‌سازی
- [ ] `npm audit` برای `xlsx` (بدون `--force`)
- [ ] HSTS و CSP
- [ ] بکاپ دیتابیس + آزمون بازیابی
- [ ] Merchant ID واقعی و `NEXT_PUBLIC_SITE_URL`
- [ ] تست کامل روی موبایل + `npm run build`

### 🟢 آینده
- [ ] OTP، فاکتور و لینک پرداخت، پرداخت دنگی، گزارش مالی

## ✅ انجام‌شده
- [x] RLS روی ۱۷ جدول و `is_admin()`
- [x] دفتر پرداخت `order_payments` + پرداخت جزئی
- [x] `rejectReceipt` و تب «پرداخت‌نشده»
- [x] قواعد اعتبار + `/admin/settings/club` + لاگ تغییرات
- [x] محافظت `customers/update`
- [x] API ثبت سفارش حضوری (`bec9bd3`، شاخهٔ `feature-walkin-orders`)
