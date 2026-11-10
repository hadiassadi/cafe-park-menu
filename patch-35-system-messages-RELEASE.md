# پچ ۳۵ — پیام‌های سیستم: خوش‌آمدگویی ایرانی در منو

## چه چیزی اضافه شد
- **مودال خوش‌آمد در منو** (صفحه اصلی + صفحه دسته‌ها): «درود بر شما، {name} عزیز 👋» + خط «آخرین حضور شما» با تاریخ و اقلام آخرین سفارش + دو دکمه «🍽 سفارش جدید» و «🔁 سفارش مجدد»
- **چیپ هویت مشتری** در هدر منو — مشتری ناشناس چیپی نمی‌بیند (حالت فعلی می‌ماند)
- **سفارش مجدد از مودال:** `/my-orders?reorder=<id>` → همان مکانیزم reorder پچ ۳۰؛ پارامتر بعد از اجرا از URL پاک می‌شود
- **بخش جدید «پیام‌های سیستم» در پنل ادمین → تنظیمات:** سوییچ روشن/خاموش، عنوان پیام، متن پیام (با جای‌نگهدار `{name}`)، آدرس تصویر/گیف سفیر برند (اختیاری)
- **لحن مرجع همه‌ی پیام‌های سیستم:** ایرانی اصیل و گرم («درود بر شما…») — پیش‌فرض‌ها در migration و کامپوننت
- مودال در هر نشست فقط یک‌بار باز می‌شود (`sessionStorage`)

## فایل‌ها
- `supabase/migrations/20261114_system_messages.sql` — ستون‌های جدید settings (اجرا در Supabase SQL Editor)
- `app/components/WelcomeBack.tsx` — کامپوننت جدید چیپ + مودال
- `app/api/settings/route.ts` — whitelist فیلدهای جدید
- `lib/menu.ts` + `lib/menu-types.ts` — ستون‌ها و تایپ‌ها
- `app/CategoriesGrid.tsx` + `app/MenuClient.tsx` — mount در hero منو
- `app/my-orders/MyOrdersClient.tsx` — پشتیبانی `?reorder=`
- `app/admin/settings/page.tsx` — بخش «پیام‌های سیستم»
- `app/globals.css` — استایل‌های `wb-*`

## اعمال
1. `git checkout -b fix/patch-35-system-messages`
2. `git apply --ignore-whitespace patch-35-system-messages-welcome.patch`
3. اجرای `supabase/migrations/20261114_system_messages.sql` در Supabase SQL Editor
4. `npx tsc --noEmit`
5. `git add -A && git commit -m "feat(ui): persian welcome modal + customer identity chip in menu, editable from admin settings (patch 35)" && git push -u origin fix/patch-35-system-messages`
6. Pull Request به main (قانون ریپو: تغییرات main فقط با PR)

## تست
- مشتری شناخته‌شده منو را باز کند → چیپ «درود بر شما، …» + مودال یک‌بار در نشست؛ رفرش بعدی مودال نمی‌آید (چیپ با کلیک دوباره بازش می‌کند)
- «🔁 سفارش مجدد» → هدایت به my-orders → اقلام آخرین سفارش به سبد → cart
- مشتری ناشناس (کوکی خالی) → هیچ چیپی/مودالی نمایش داده نشود
- پنل ادمین → تنظیمات → پیام‌های سیستم → تغییر متن و ذخیره → منو متن جدید را نشان دهد
- سوییچ خاموش → چیپ و مودال کلاً حذف شوند
