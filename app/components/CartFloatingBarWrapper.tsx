'use client'

import { usePathname } from 'next/navigation'
import CartFloatingBar from './CartFloatingBar'

export default function CartFloatingBarWrapper() {
  const pathname = usePathname()

  // مسیرهایی که نباید سبد خرید شناور در آن‌ها نمایش داده شود
  const hideOnPaths = [
    '/admin',      // کل پنل ادمین
    '/cart',       // خود سبد خرید
    '/checkout',   // ثبت سفارش
    '/order',      // صفحه جزئیات سفارش (چون دکمه واتساپ پایین داره)
    '/my-orders',  // سفارش‌های من
    '/login',      // صفحه ورود ادمین
  ]

  // اگر مسیر فعلی با یکی از موارد بالا شروع بشه، نوار رو نشون نده
  const shouldHide = hideOnPaths.some((path) => pathname?.startsWith(path))

  if (shouldHide) return null

  return <CartFloatingBar />
}