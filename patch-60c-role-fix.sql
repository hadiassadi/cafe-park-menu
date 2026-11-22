-- ===== پچ ۶۰-ج: تشخیص و اصلاح نقش کاربران پنل =====
-- ⚠️ در Supabase → SQL Editor → بخش‌به‌بخش اجرا کن (هر بخش یک Run)
--
-- علامت مشکل: کاربر صندوق‌دار همهٔ منوها را می‌بیند و به حسابداری هم وارد می‌شود.
-- علت: نقشِ آن کاربر در جدول «مالک (owner)» ثبت شده — مالک به‌طراحی سلب‌ناپذیر
-- است و تیک‌های صفحهٔ دسترسی‌ها روی مالک اثری ندارند.

-- ── ۱) وضعیت واقعی همهٔ کاربران پنل — نتیجه را ببین (نقش c2 چیست؟)
select p.display_name,
       u.email,
       p.role,
       p.is_active,
       coalesce(p.allowed_paths::text, '[]') as allowed_paths
  from public.admin_operator_profiles p
  left join auth.users u on u.id = p.user_id
 order by u.email;

-- ── ۲) نقش c2 را صندوق‌دار کن
-- (اگر در خروجی بخش ۱ نقشش owner بود، این دستور مشکل را حل می‌کند؛
--  اگر نبود، اجرایش بی‌ضرر است)
update public.admin_operator_profiles p
   set role = 'cashier'
  from auth.users u
 where p.user_id = u.id
   and u.email = 'c2@cafepark.com';

-- ── ۳) کنترل — باید نقش cashier برای c2 نشان بدهد
select u.email, p.role, coalesce(p.allowed_paths::text, '[]') as allowed_paths
  from public.admin_operator_profiles p
  join auth.users u on u.id = p.user_id
 where u.email = 'c2@cafepark.com';
