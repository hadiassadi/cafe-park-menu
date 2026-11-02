'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

function CartContent() {
  const searchParams = useSearchParams()
  const { items, totalItems, totalPrice, takeawayTotal, updateQuantity, setItemTakeaway, removeItem, clearCart } = useCart()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [tableNumber, setTableNumber] = useState<string>('')

  // ✅ خواندن شماره میز: اول از URL، بعد از sessionStorage
  useEffect(() => {
    const tableFromUrl = searchParams.get('table')
    if (tableFromUrl && /^\d+$/.test(tableFromUrl)) {
      setTableNumber(tableFromUrl)
      try {
        sessionStorage.setItem('cafe-park-table', tableFromUrl)
      } catch {}
      return
    }
    try {
      const saved = sessionStorage.getItem('cafe-park-table')
      if (saved) setTableNumber(saved)
    } catch {}
  }, [searchParams])

  const tableSuffix = tableNumber ? `?table=${tableNumber}` : ''

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <h1>سبد خرید خالی است</h1>
          <p>هنوز چیزی به سبد اضافه نکردی</p>
          <Link href="/" className="cart-btn-primary">
            ← بازگشت به منو
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <header className="cart-header">
        <Link href="/" className="cart-back">
          ← بازگشت
        </Link>
        <h1>🛒 سبد خرید</h1>
        <span className="cart-count">{formatPrice(totalItems)} قلم</span>
      </header>

      {tableNumber && (
        <div className="cart-table-badge">
          📍 سفارش برای میز شماره {formatPrice(Number(tableNumber))}
        </div>
      )}

      <div className="cart-items">
        {items.map((item) => (
          <div key={item.id} className="cart-item">
            {item.productImage && (
              <div className="cart-item-image">
                <Image
                  src={item.productImage}
                  alt={item.productName}
                  width={80}
                  height={80}
                />
              </div>
            )}

            <div className="cart-item-info">
              <div className="cart-item-name">{item.productName}</div>

              {item.selectedOptionName && (
                <div className="cart-item-variant">
                  {item.selectedGroupName && (
                    <span className="cart-item-variant-group">
                      {item.selectedGroupName}:
                    </span>
                  )}
                  <span>{item.selectedOptionName}</span>
                </div>
              )}

              <div className="cart-item-price">
                {formatPrice(item.unitPrice)} <small>تومان</small>
              </div>

                        {(item.takeawayFee ?? 0) > 0 && (
            <label
              className="check-label"
              style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0', fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={Boolean(item.takeaway)}
                onChange={(e) => setItemTakeaway(item.id, e.target.checked)}
              />
              <span>
                🥡 بیرون‌بر (+{formatPrice(item.takeawayFee ?? 0)} تومان به‌ازای هر عدد)
              </span>
            </label>
          )}
              <div className="cart-item-actions">
                <div className="qty-selector">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="qty-btn-sm"
                  >
                    −
                  </button>
                  <span className="qty-value-sm">
                    {formatPrice(item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="qty-btn-sm"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="cart-item-remove"
                  onClick={() => removeItem(item.id)}
                  aria-label="حذف"
                >
                  🗑
                </button>
              </div>
            </div>

            <div className="cart-item-total">
              {formatPrice(item.unitPrice * item.quantity)}
              <small> تومان</small>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>تعداد کل</span>
          <strong>{formatPrice(totalItems)} قلم</strong>
        </div>

        {takeawayTotal > 0 && (
          <>
            <div className="cart-summary-row">
              <span>جمع اقلام</span>
              <strong>
                {formatPrice(totalPrice)} <small>تومان</small>
              </strong>
            </div>
            <div className="cart-summary-row">
              <span>هزینهٔ بیرون‌بر</span>
              <strong>
                {formatPrice(takeawayTotal)} <small>تومان</small>
              </strong>
            </div>
          </>
        )}

        <div className="cart-summary-row cart-summary-total">
          <span>جمع کل</span>
          <strong>
            {formatPrice(totalPrice + takeawayTotal)} <small>تومان</small>
          </strong>
        </div>

      </div>

      <div className="cart-actions">
        <Link href={`/checkout${tableSuffix}`} className="cart-btn-primary">
          ادامه و ثبت سفارش ←
        </Link>

        <button
          type="button"
          className="cart-btn-secondary"
          onClick={() => setShowClearConfirm(true)}
        >
          خالی کردن سبد
        </button>
      </div>

      {showClearConfirm && (
        <div
          className="cart-confirm-overlay"
          onClick={() => setShowClearConfirm(false)}
        >
          <div className="cart-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>مطمئنی؟</h3>
            <p>همه آیتم‌های سبد حذف می‌شن.</p>
            <div className="cart-confirm-actions">
              <button
                type="button"
                className="cart-btn-danger"
                onClick={() => {
                  clearCart()
                  setShowClearConfirm(false)
                }}
              >
                بله، خالی کن
              </button>
              <button
                type="button"
                className="cart-btn-secondary"
                onClick={() => setShowClearConfirm(false)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CartPage() {
  return (
    <Suspense fallback={<div className="cart-page">در حال بارگذاری...</div>}>
      <CartContent />
    </Suspense>
  )
}