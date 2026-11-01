$path = "PROJECT_STATE.md"
Copy-Item $path "PROJECT_STATE.bak.md" -Force
$lines = [IO.File]::ReadAllLines((Resolve-Path $path), [Text.Encoding]::UTF8)

$blockDone = @'
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

'@

$blockTodo = @'
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

'@

$logRows = @'
| 1405/08/09 | سخت‌سازی دیتابیس: RLS روی ۱۷ جدول، `is_admin()`، گرفتن مجوزهای اضافه. هش HMAC-SHA256 (شاخهٔ `harden-hash-salt`) |
| 1405/08/09 | دفتر پرداخت `order_payments`، پرداخت جزئی، اصلاح `rejectReceipt` و تب «پرداخت‌نشده» |
| 1405/08/09 | قواعد اعتبار پرداخت حضوری، تأیید شماره، `credit_override`، محافظت `customers/update` |
| 1405/08/10 | صفحهٔ `/admin/settings/club` با لاگ تغییرات (`e10097f`)؛ `feature-club-rules` ادغام شد |
| 1405/08/10 | API ثبت سفارش حضوری `admin/orders/create` ساخته و تست شد (بدون commit) |
'@

$rules = @'
28. **سفارش حضوری از مسیر جدا ساخته می‌شود** (`api/admin/orders/create`)، چون قفل دستگاه و تخفیف باشگاه برای پرسنل مناسب نیست.
29. **برای لاگ تغییرات از `assertAdminId()` استفاده شود** (`assertAdmin()` شناسه برنمی‌گرداند).
30. **`next-env.d.ts` و `*.bak` commit نشوند.**
31. **برای هر ویژگی بزرگ شاخهٔ جدا بسازید** و بعد از تست Preview ادغام کنید.
'@

$decisions = @'
96. **قواعد اعتبار جدا از `memberships`:** بر پایهٔ سابقهٔ مشتری (سفارش تسویه‌شده، بدهی باز، تأیید شماره).
97. **بدهی باز** = مجموع سفارش‌های غیرلغو/غیرحذف‌شده منهای پرداخت‌های `confirmed` در `order_payments`.
98. **سفارش حضوری بدون تخفیف و کوپن** ساخته و با ابزار تسویهٔ موجود تسویه می‌شود.
99. **مشتری بی‌نام** = شمارهٔ خالی؛ در CRM نیست ولی در سفارش‌ها و گزارش‌ها هست.
'@

$out = New-Object System.Collections.Generic.List[string]
$skip = $false
$n = @{date=0; done=0; todo=0; log=0; rules=0; dec=0}

foreach ($l in $lines) {
  if ($skip) {
    if ($l -like '### * اولویت متوسط*') { $skip = $false } else { continue }
  }
  if ($l.StartsWith('**آخرین آپدیت:**')) {
    $out.Add('**آخرین آپدیت:** ۱۴۰۵/۰۸/۱۰ (2026-11-01)'); $n.date++; continue
  }
  if ($l -like '### رفع باگ*' -and $n.done -eq 0) {
    $out.Add($blockDone.TrimEnd()); $out.Add(''); $n.done++
  }
  if ($l -like '### * اولویت بالا*') {
    $out.Add($blockTodo.TrimEnd()); $out.Add(''); $n.todo++; $skip = $true; continue
  }
  $out.Add($l)
  if ($l.StartsWith('|') -and $l -like '*ادغام مستندات باشگاه*') { $out.Add($logRows.TrimEnd()); $n.log++ }
  if ($l.StartsWith('27. **')) { $out.Add($rules.TrimEnd()); $n.rules++ }
  if ($l.StartsWith('95. **')) { $out.Add($decisions.TrimEnd()); $n.dec++ }
}

[IO.File]::WriteAllText((Join-Path (Get-Location) $path), ([string]::Join("`n", $out) + "`n"), (New-Object Text.UTF8Encoding($false)))
$n.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name) = $($_.Value)" }
