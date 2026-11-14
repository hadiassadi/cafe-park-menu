-- 🎯 پچ ۵۰-هـ-خ: سفارش ضمیمه (مکمل) — اقلام اضافه برای سفارش‌های تمام‌شده.
-- سفارشِ ضمیمه یک فاکتورِ جدیدِ مستقل است که با parent_order_id به سفارش اصلی
-- وصل می‌شود؛ حساب صندوق و فاکتور اصلی دست‌نخورده می‌ماند و پرداخت‌های
-- زنجیره (اصلی + ضمیمه‌ها) در POS یکجا نمایش و ثبت می‌شود.
-- اجرا: Supabase Dashboard → SQL Editor → Run

alter table public.orders
  add column if not exists parent_order_id uuid references public.orders (id)
    on delete set null;

create index if not exists orders_parent_order_id_idx
  on public.orders (parent_order_id);
