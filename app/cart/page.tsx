'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

export default function CartPage() {
  const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart()
  const [showClearConfirm, setShowClearConfirm] = useState(false)

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
      {/* هدر */}
      <header className="cart-header">
        <Link href="/" className="cart-back">
          ← بازگشت
        </Link>
        <h1>🛒 سبد خرید</h1>
        <span className="cart-count">{formatPrice(totalItems)} قلم</span>
      </header>

      {/* لیست آیتم‌ها */}
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
                {formatPrice(item.unitPrice)}{' '}
                <small>تومان</small>
              </div>

              <div className="cart-item-actions">
                <div className="qty-selector">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.id, item.quantity - 1)
                    }
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
                    onClick={() =>
                      updateQuantity(item.id, item.quantity + 1)
                    }
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

      {/* خلاصه */}
      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>تعداد کل</span>
          <strong>{formatPrice(totalItems)} قلم</strong>
        </div>

        <div className="cart-summary-row cart-summary-total">
          <span>جمع کل</span>
          <strong>
            {formatPrice(totalPrice)} <small>تومان</small>
          </strong>
        </div>
      </div>

      {/* دکمه‌ها */}
      <div className="cart-actions">
        <Link href="/checkout" className="cart-btn-primary">
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

      {/* تأیید خالی کردن */}
      {showClearConfirm && (
        <div className="cart-confirm-overlay" onClick={() => setShowClearConfirm(false)}>
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