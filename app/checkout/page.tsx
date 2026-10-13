'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

const toLatinDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

type AppliedCoupon = {
  id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
}

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { items, totalItems, totalPrice, clearCart } = useCart()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // کوپن
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const [discount, setDiscount] = useState(0)
  const [eligibleSubtotal, setEligibleSubtotal] = useState(0)
  const [ineligibleSubtotal, setIneligibleSubtotal] = useState(0)
  const [eligibleProductIds, setEligibleProductIds] = useState<string[]>([])

  const finalTotal = totalPrice - discount

  // خوندن شماره میز از URL
  useEffect(() => {
    const table = searchParams.get('table')
    if (table) setTableNumber(table)
  }, [searchParams])

  // اگه سبد خالی بود برگرد
  useEffect(() => {
    if (items.length === 0 && !submitted) {
      router.replace('/cart')
    }
  }, [items.length, router, submitted])

  // اگه سبد تغییر کرد، کوپن رو پاک کن
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setDiscount(0)
      setEligibleSubtotal(0)
      setIneligibleSubtotal(0)
      setEligibleProductIds([])
      setCouponCode('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPrice])

  async function handleApplyCoupon() {
    const code = couponCode.trim().toUpperCase()
    if (!code) {
      setCouponError('کد تخفیف رو وارد کن')
      return
    }

    setCouponLoading(true)
    setCouponError(null)

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          subtotal: totalPrice,
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'کد تخفیف معتبر نیست')
      }

      setAppliedCoupon(data.coupon)
      setDiscount(data.discount)
      setEligibleSubtotal(data.eligibleSubtotal)
      setIneligibleSubtotal(data.ineligibleSubtotal)
      setEligibleProductIds(data.eligibleProductIds || [])
      setCouponError(null)
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'خطا')
      setAppliedCoupon(null)
      setDiscount(0)
      setEligibleSubtotal(0)
      setIneligibleSubtotal(0)
      setEligibleProductIds([])
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setDiscount(0)
    setEligibleSubtotal(0)
    setIneligibleSubtotal(0)
    setEligibleProductIds([])
    setCouponCode('')
    setCouponError(null)
  }

  if (items.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!name.trim()) throw new Error('نام رو وارد کن')
      const cleanPhone = toLatinDigits(phone).replace(/\D/g, '')
      if (cleanPhone.length < 10) throw new Error('شماره تماس معتبر نیست')

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: cleanPhone,
          table_number: tableNumber ? Number(tableNumber) : null,
          note: note.trim() || null,
          items: items.map((item) => ({
            product_id: item.productId,
            product_name: item.productName,
            option_id: item.selectedOptionId,
            option_name: item.selectedOptionName,
            group_name: item.selectedGroupName,
            unit_price: item.unitPrice,
            quantity: item.quantity,
          })),
          subtotal: totalPrice,
          coupon_code: appliedCoupon?.code || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'خطا در ثبت سفارش')
      }

      try {
        localStorage.setItem(
          'cafe-park-customer',
          JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
          })
        )
      } catch {}

      setSubmitted(true)
      clearCart()
      window.location.href = `/order/${data.order.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت سفارش')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <Link href="/cart" className="cart-back">
          ← بازگشت به سبد
        </Link>
        <h1>ثبت سفارش</h1>
        <span style={{ width: 80 }} />
      </header>

      <form onSubmit={handleSubmit} className="checkout-form">
        {/* خلاصه سفارش */}
        <div className="checkout-card">
          <div className="checkout-card-title">
            🧾 خلاصه سفارش ({formatPrice(totalItems)} قلم)
          </div>
          <ul className="checkout-items">
            {items.map((item) => {
              const isEligible = appliedCoupon
                ? eligibleProductIds.includes(item.productId)
                : null

              return (
                <li
                  key={item.id}
                  className={`checkout-item ${
                    isEligible === true
                      ? 'item-eligible'
                      : isEligible === false
                        ? 'item-ineligible'
                        : ''
                  }`}
                >
                  <span className="checkout-item-name">
                    {formatPrice(item.quantity)} × {item.productName}
                    {item.selectedOptionName && (
                      <small> ({item.selectedOptionName})</small>
                    )}
                    {isEligible === true && (
                      <span className="item-badge badge-eligible">
                        ✅ شامل تخفیف
                      </span>
                    )}
                    {isEligible === false && (
                      <span className="item-badge badge-ineligible">
                        🚫 بدون تخفیف
                      </span>
                    )}
                  </span>
                  <span className="checkout-item-price">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="checkout-total">
            <span>جمع کل</span>
            <strong>
              {formatPrice(totalPrice)} <small>تومان</small>
            </strong>
          </div>
        </div>

        {/* کارت کد تخفیف */}
        <div className="checkout-card">
          <div className="checkout-card-title">🎟️ کد تخفیف</div>

          {!appliedCoupon ? (
            <div className="coupon-input-row">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase())
                  setCouponError(null)
                }}
                placeholder="مثلاً WELCOME10"
                dir="ltr"
                style={{ textAlign: 'left', textTransform: 'uppercase' }}
                disabled={couponLoading || saving}
              />
              <button
                type="button"
                className="coupon-apply-btn"
                onClick={handleApplyCoupon}
                disabled={couponLoading || saving || !couponCode.trim()}
              >
                {couponLoading ? '...' : 'اعمال'}
              </button>
            </div>
          ) : (
            <div className="coupon-applied">
              <div className="coupon-applied-info">
                <span className="coupon-applied-code">{appliedCoupon.code}</span>
                {appliedCoupon.description && (
                  <small>{appliedCoupon.description}</small>
                )}
              </div>
              <button
                type="button"
                className="coupon-remove-btn"
                onClick={handleRemoveCoupon}
                disabled={saving}
              >
                ✕
              </button>
            </div>
          )}

          {couponError && <div className="coupon-error">❌ {couponError}</div>}
        </div>

        {/* اطلاعات مشتری */}
        <div className="checkout-card">
          <div className="checkout-card-title">📋 اطلاعات شما</div>

          <div className="checkout-field">
            <label htmlFor="name">نام و نام خانوادگی *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً احمد رضایی"
              required
              autoComplete="name"
              disabled={saving}
            />
          </div>

          <div className="checkout-field">
            <label htmlFor="phone">شماره تماس *</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              required
              autoComplete="tel"
              inputMode="tel"
              dir="ltr"
              disabled={saving}
            />
          </div>

          <div className="checkout-field">
            <label htmlFor="table">شماره میز (اختیاری)</label>
            <input
              id="table"
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="مثلاً ۵"
              min="1"
              disabled={saving}
            />
          </div>

          <div className="checkout-field">
            <label htmlFor="note">توضیحات (اختیاری)</label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: قند جدا، بدون شکر..."
              rows={3}
              disabled={saving}
            />
          </div>
        </div>

        {/* خلاصه نهایی */}
        <div className="checkout-card">
          <div className="checkout-card-title">💰 خلاصه نهایی</div>

          <div className="checkout-total-row">
            <span>جمع اقلام:</span>
            <strong>{formatPrice(totalPrice)} تومان</strong>
          </div>

          {discount > 0 && (
            <div className="checkout-total-row discount">
              <span>🎟️ تخفیف ({appliedCoupon?.code}):</span>
              <strong>− {formatPrice(discount)} تومان</strong>
            </div>
          )}

          {discount > 0 && ineligibleSubtotal > 0 && (
            <div className="checkout-discount-note">
              <span className="checkout-discount-note-icon">💡</span>
              <span>
                تخفیف روی {formatPrice(eligibleSubtotal)} تومان از سفارش اعمال
                شد. {formatPrice(ineligibleSubtotal)} تومان دیگر شامل تخفیف
                نمی‌شن.
              </span>
            </div>
          )}

          <div className="checkout-total-row final">
            <span>قابل پرداخت:</span>
            <strong>
              {formatPrice(finalTotal)} <small>تومان</small>
            </strong>
          </div>
        </div>

        {error && <div className="checkout-error">❌ {error}</div>}

        <button type="submit" className="checkout-btn" disabled={saving}>
          {saving ? 'در حال ثبت...' : 'ثبت سفارش ✅'}
        </button>

        <p className="checkout-note">
          با ثبت سفارش، اطلاعات شما در سیستم کافه ذخیره می‌شود.
        </p>
      </form>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={<div className="checkout-page">در حال بارگذاری...</div>}
    >
      <CheckoutForm />
    </Suspense>
  )
}