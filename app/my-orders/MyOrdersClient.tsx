'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
  variant_option_id?: string | null
  variant_group_id?: string | null
  product_id?: string | null
  image_url?: string | null
}

type Order = {
  id: string
  order_number: number
  items: OrderItem[]
  subtotal: number
  original_subtotal: number | null
  coupon_code: string | null
  coupon_discount: number | null
  status: string
  created_at: string
  cancelled_by: string | null
  cancellation_reason_label: string | null
}

type Filter = 'all' | 'active' | 'delivered' | 'cancelled'

const FILTER_LABELS: Record<Filter, string> = {
  all: 'همه',
  active: 'در جریان',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'در انتظار تأیید', color: '#9a6b3f', icon: '⏳' },
  confirmed: { label: 'تأیید شده', color: '#4a7c9b', icon: '✓' },
  preparing: { label: 'در حال آماده‌سازی', color: '#9a6b3f', icon: '☕' },
  ready: { label: 'آماده تحویل', color: '#477052', icon: '🔔' },
  delivered: { label: 'تحویل شده', color: '#477052', icon: '✅' },
  cancelled: { label: 'لغو شده', color: '#9b3c32', icon: '❌' },
}

export default function MyOrdersClient() {
  const { addItem } = useCart()
  const [phone, setPhone] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const [loginStep, setLoginStep] = useState<'phone' | 'code'>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [shownCode, setShownCode] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/customer/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.customer) {
          setPhone(data.customer.phone)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!phone) return
    setLoading(true)
    fetch('/api/customer/orders', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [phone])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  async function handleSendOtp() {
    setSending(true)
    setLoginError(null)

    try {
      const res = await fetch('/api/customer/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput }),
      })
      const data = await res.json()

      if (!res.ok) {
        setLoginError(data.error || 'خطا در ارسال کد')
      } else {
        setShownCode(data.code)
        setLoginStep('code')
      }
    } catch {
      setLoginError('خطای شبکه')
    }
    setSending(false)
  }

  async function handleVerifyOtp() {
    setVerifying(true)
    setLoginError(null)

    try {
      const res = await fetch('/api/customer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput, code: codeInput }),
      })
      const data = await res.json()

      if (!res.ok) {
        setLoginError(data.error || 'کد اشتباه است')
      } else {
        setPhone(data.phone)
        setShownCode(null)
        setCodeInput('')
      }
    } catch {
      setLoginError('خطای شبکه')
    }
    setVerifying(false)
  }

  async function handleLogout() {
    await fetch('/api/customer/logout', { method: 'POST' })
    setPhone(null)
    setOrders([])
    setPhoneInput('')
    setCodeInput('')
    setShownCode(null)
    setLoginStep('phone')
  }

  // ✅ آپدیت شد: استفاده از اسم‌های درست CartItem
  function handleReorder(order: Order) {
    for (const item of order.items) {
      addItem({
        productId: item.product_id || '',
        productName: item.product_name,
        productImage: item.image_url || null,
        selectedGroupName: null,
        selectedOptionName: item.option_name,
        selectedOptionId: item.variant_option_id || null,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        note: undefined,
      })
    }
    setToast('✅ آیتم‌ها به سبد اضافه شدن')
    setTimeout(() => {
      window.location.href = '/cart'
    }, 800)
  }

  if (loading && !phone && !phoneInput) {
    return (
      <div className="my-orders-page">
        <div className="my-orders-header">
          <Link href="/" className="my-orders-back">← منو</Link>
          <h1>سفارش‌های من</h1>
          <span style={{ width: 60 }} />
        </div>
        <div className="my-orders-empty">⏳ در حال بارگذاری...</div>
      </div>
    )
  }

  if (!phone) {
    return (
      <div className="my-orders-page">
        <div className="my-orders-header">
          <Link href="/" className="my-orders-back">← منو</Link>
          <h1>ورود / ثبت‌نام</h1>
          <span style={{ width: 60 }} />
        </div>

        <div className="customer-login-card">
          {loginStep === 'phone' ? (
            <>
              <div className="customer-login-icon">📱</div>
              <h2>شماره موبایلت رو وارد کن</h2>
              <p className="customer-login-hint">
                بعد از تأیید، می‌تونی سفارش‌های قبلیت رو ببینی و دوباره سفارش بدی.
              </p>

              <div className="customer-login-field">
                <label>شماره موبایل</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="09123456789"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendOtp()
                  }}
                  disabled={sending}
                  dir="ltr"
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="customer-login-error">❌ {loginError}</div>
              )}

              <button
                type="button"
                className="customer-login-btn"
                onClick={handleSendOtp}
                disabled={sending || !phoneInput.trim()}
              >
                {sending ? '...' : 'دریافت کد'}
              </button>
            </>
          ) : (
            <>
              <div className="customer-login-icon">🔐</div>
              <h2>کد تأیید رو وارد کن</h2>
              <p className="customer-login-hint">
                کد ۴ رقمی به شماره <strong dir="ltr">{phoneInput}</strong> فرستاده شده.
              </p>

              {shownCode && (
                <div className="customer-login-code-display">
                  <span>کد شما (نمایشی):</span>
                  <strong>{shownCode}</strong>
                </div>
              )}

              <div className="customer-login-field">
                <label>کد ۴ رقمی</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="----"
                  value={codeInput}
                  onChange={(e) =>
                    setCodeInput(e.target.value.replace(/\D/g, ''))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyOtp()
                  }}
                  disabled={verifying}
                  dir="ltr"
                  autoFocus
                  style={{
                    textAlign: 'center',
                    fontSize: '24px',
                    letterSpacing: '8px',
                    fontWeight: 800,
                  }}
                />
              </div>

              {loginError && (
                <div className="customer-login-error">❌ {loginError}</div>
              )}

              <button
                type="button"
                className="customer-login-btn"
                onClick={handleVerifyOtp}
                disabled={verifying || codeInput.length !== 4}
              >
                {verifying ? '...' : 'تایید و ورود'}
              </button>

              <button
                type="button"
                className="customer-login-link"
                onClick={() => {
                  setLoginStep('phone')
                  setCodeInput('')
                  setShownCode(null)
                  setLoginError(null)
                }}
                disabled={verifying}
              >
                ← تغییر شماره
              </button>
            </>
          )}
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  const filtered = orders.filter((o) => {
    if (filter === 'all') return true
    if (filter === 'active')
      return ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
    if (filter === 'delivered') return o.status === 'delivered'
    if (filter === 'cancelled') return o.status === 'cancelled'
    return true
  })

  return (
    <div className="my-orders-page">
      <div className="my-orders-header">
        <Link href="/" className="my-orders-back">← منو</Link>
        <h1>سفارش‌های من</h1>
        <button
          type="button"
          className="my-orders-logout"
          onClick={handleLogout}
        >
          🚪 خروج
        </button>
      </div>

      <div className="my-orders-user">
        <div className="my-orders-user-icon">👤</div>
        <div>
          <strong dir="ltr">{phone}</strong>
          <small>{formatPrice(orders.length)} سفارش</small>
        </div>
      </div>

      <div className="my-orders-filters">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="my-orders-empty">
          {orders.length === 0
            ? 'هنوز سفارشی ثبت نکردی.'
            : 'سفارشی با این فیلتر پیدا نشد.'}
        </div>
      ) : (
        <div className="my-orders-list">
          {filtered.map((order) => {
            const info = STATUS_INFO[order.status] || STATUS_INFO.pending
            return (
              <div key={order.id} className="my-order-card">
                <div className="my-order-header">
                  <div className="my-order-num">
                    🧾 سفارش #{formatPrice(order.order_number)}
                  </div>
                  <span
                    className="my-order-status"
                    style={{ background: info.color + '20', color: info.color }}
                  >
                    {info.icon} {info.label}
                  </span>
                </div>

                <div className="my-order-date">
                  📅 {formatDateTime(order.created_at)}
                </div>

                <div className="my-order-items">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="my-order-item">
                      <span>
                        {formatPrice(item.quantity)}× {item.product_name}
                        {item.option_name && (
                          <small> ({item.option_name})</small>
                        )}
                      </span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="my-order-item-more">
                      + {formatPrice(order.items.length - 3)} آیتم دیگه
                    </div>
                  )}
                </div>

                <div className="my-order-total">
                  <span>جمع کل:</span>
                  <strong>{formatPrice(order.subtotal)} تومان</strong>
                </div>

                {order.status === 'cancelled' && order.cancelled_by === 'admin' && (
                  <div className="my-order-cancel-reason">
                    دلیل لغو: {order.cancellation_reason_label || 'نامشخص'}
                  </div>
                )}

                <div className="my-order-actions">
                  <button
                    type="button"
                    className="my-order-btn primary"
                    onClick={() => handleReorder(order)}
                  >
                    🔄 سفارش مجدد
                  </button>
                  <Link
                    href={`/order/${order.id}`}
                    className="my-order-btn"
                  >
                    👁️ جزئیات
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}