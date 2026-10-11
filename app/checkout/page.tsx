'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

// ارقام فارسی → انگلیسی
const toLatinDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

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
const [submitted, setSubmitted] = useState(false)   // ✅ جدید

// خوندن شماره میز از URL
useEffect(() => {
  const table = searchParams.get('table')
  if (table) setTableNumber(table)
}, [searchParams])

// اگه سبد خالی بود برگرد (فقط اگه سفارش ثبت نشده باشه)
useEffect(() => {
  if (items.length === 0 && !submitted) {
    router.replace('/cart')
  }
}, [items.length, router, submitted])

  if (items.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // اعتبارسنجی
      if (!name.trim()) throw new Error('نام رو وارد کن')
      const cleanPhone = toLatinDigits(phone).replace(/\D/g, '')
      if (cleanPhone.length < 10) throw new Error('شماره تماس معتبر نیست')

      // ارسال به API
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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'خطا در ثبت سفارش')
      }

            // ذخیره اطلاعات مشتری برای بار بعد
      try {
        localStorage.setItem(
          'cafe-park-customer',
          JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
          })
        )
      } catch {}

      // ✅ پاک کردن سبد
      clearCart()

      // ✅ استفاده از window.location.href (نه router.push)
      // این باعث می‌شه صفحه کامل رفرش شه و race condition نداشته باشیم
      window.location.href = `/order/${data.order.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت سفارش')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="checkout-page">
      {/* هدر */}
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
            {items.map((item) => (
              <li key={item.id} className="checkout-item">
                <span className="checkout-item-name">
                  {formatPrice(item.quantity)} × {item.productName}
                  {item.selectedOptionName && (
                    <small> ({item.selectedOptionName})</small>
                  )}
                </span>
                <span className="checkout-item-price">
                  {formatPrice(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="checkout-total">
            <span>جمع کل</span>
            <strong>
              {formatPrice(totalPrice)} <small>تومان</small>
            </strong>
          </div>
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

        {/* خطا */}
        {error && <div className="checkout-error">❌ {error}</div>}

        {/* دکمه ثبت */}
        <button
          type="submit"
          className="checkout-btn"
          disabled={saving}
        >
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
    <Suspense fallback={<div className="checkout-page">در حال بارگذاری...</div>}>
      <CheckoutForm />
    </Suspense>
  )
}