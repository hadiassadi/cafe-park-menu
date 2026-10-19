'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

export default function CartFloatingBar() {
  const { totalItems, totalPrice } = useCart()
  const pathname = usePathname()

  // ✅ لیست صفحاتی که سبد نباید نمایش داده بشه
  const hiddenPaths = ['/cart', '/checkout']
  const isHiddenPage =
    hiddenPaths.includes(pathname) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/order/')

  if (totalItems === 0 || isHiddenPage) return null

  return (
    <div className="cart-floating-bar">
      <Link href="/cart" className="cart-floating-btn">
        <span className="cart-floating-count">
          🛒 {formatPrice(totalItems)}
        </span>
        <span className="cart-floating-text">مشاهده سبد</span>
        <span className="cart-floating-price">
          {formatPrice(totalPrice)} <small>تومان</small>
        </span>
      </Link>
    </div>
  )
}