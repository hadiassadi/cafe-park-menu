'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
}

type Order = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  table_number: number | null
  note: string | null
  items: OrderItem[]
  subtotal: number
  original_subtotal: number | null
  coupon_code: string | null
  coupon_discount: number | null
  eligible_subtotal: number | null
  ineligible_subtotal: number | null
  status: string
  created_at: string
  cancellation_reason_label: string | null
  cancellation_note: string | null
  cancelled_by: string | null
}

const STATUS_STEPS = [
  { key: 'pending', label: 'ثبت شد', icon: '✓' },
  { key: 'confirmed', label: 'تأیید شد', icon: '✓' },
  { key: 'preparing', label: 'آماده‌سازی', icon: '⏳' },
  { key: 'ready', label: 'آماده تحویل', icon: '🔔' },
  { key: 'delivered', label: 'تحویل شد', icon: '🎉' },
]

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ✅ State های مربوط به لغو
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // ✅ state های دلیل لغو
  const [reasons, setReasons] = useState<
    Array<{ id: string; label: string; icon: string | null }>
  >([])
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [loadingReasons, setLoadingReasons] = useState(false)

  // ✅ بارگذاری اولیه سفارش
  useEffect(() => {
    async function load() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!url || !key) {
        setError('تنظیمات ناقص')
        setLoading(false)
        return
      }
      const supabase = createClient(url, key)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        setError('سفارش پیدا نشد')
      } else {
        setOrder(data as Order)
      }
      setLoading(false)
    }
    load()
  }, [id])

  // ✅ بروزرسانی خودکار هر ۱۰ ثانیه
  useEffect(() => {
    if (!order) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return

    const supabase = createClient(url, key)
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (data) setOrder(data as Order)
    }, 10000)

    return () => clearInterval(interval)
  }, [id, order])

  // ✅ تایمر شمارش معکوس برای دکمه لغو
  useEffect(() => {
    if (!order || order.status !== 'pending') {
      setCanCancel(false)
      setSecondsLeft(0)
      return
    }

    const WINDOW_MS = 5 * 60 * 1000
    const createdAt = new Date(order.created_at).getTime()

    function tick() {
      const remaining = WINDOW_MS - (Date.now() - createdAt)

      if (remaining <= 0) {
        setCanCancel(false)
        setSecondsLeft(0)
        return false
      }

      setCanCancel(true)
      setSecondsLeft(Math.floor(remaining / 1000))
      return true
    }

    if (!tick()) return

    const interval = setInterval(() => {
      if (!tick()) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [order])

  // ✅ لود دلایل لغو وقتی مودال باز میشه
  useEffect(() => {
    if (!showCancelConfirm) return
    if (reasons.length > 0) return

    let cancelled = false
    setLoadingReasons(true)

    fetch('/api/cancellation-reasons?target=customer')
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          setReasons(result.reasons || [])
          setLoadingReasons(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoadingReasons(false)
      })

    return () => {
      cancelled = true
    }
  }, [showCancelConfirm, reasons.length])

  async function handleCancelOrder() {
    if (!order) return
    setCancelling(true)
    setCancelError(null)

    try {
      const selectedReason = reasons.find((r) => r.id === selectedReasonId)

      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          phone: order.customer_phone,
          reasonId: selectedReasonId,
          reasonLabel: selectedReason?.label || null,
          note: cancelNote.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'خطا در لغو سفارش')
      }

      setOrder({ ...order, status: 'cancelled' })
      setCancelSuccess(true)
      setShowCancelConfirm(false)

      setTimeout(() => setCancelSuccess(false), 3000)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'خطا')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div
        className="order-detail-container"
        style={{ textAlign: 'center', paddingTop: '50px' }}
      >
        در حال بارگذاری سفارش...
      </div>
    )
  }

  if (error || !order) {
    return (
      <div
        className="order-detail-container"
        style={{ textAlign: 'center', paddingTop: '50px' }}
      >
        <div style={{ fontSize: 48 }}>😕</div>
        <h1>{error || 'خطا'}</h1>
        <Link
          href="/"
          className="btn primary-btn"
          style={{ marginTop: '20px', display: 'inline-flex' }}
        >
          بازگشت به منو
        </Link>
      </div>
    )
  }

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === order.status)
  const isCancelled = order.status === 'cancelled'

  const whatsappMessage = buildWhatsAppMessage(order)
  const whatsappUrl = `https://wa.me/989301817098?text=${encodeURIComponent(
    whatsappMessage
  )}`

  return (
    <div className="order-detail-container">
      {/* هدر صفحه */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}
      >
        <Link href="/" className="btn" style={{ padding: '6px 12px' }}>
          ← منو
        </Link>
        <h1 style={{ fontSize: '20px', margin: 0, color: '#29251f' }}>
          سفارش #{formatPrice(order.order_number)}
        </h1>
        <span style={{ width: '60px' }} />
      </div>

      {/* استپر وضعیت یا کارت لغو */}
      {isCancelled ? (
        <div
          className="info-card"
          style={{ textAlign: 'center', padding: '30px' }}
        >
          <div style={{ fontSize: 48 }}>❌</div>
          <h2 style={{ color: '#9b3c32' }}>سفارش لغو شد</h2>

          {/* ✅ نمایش دلیل لغو (فقط اگه ادمین لغو کرده) */}
          {order.cancelled_by === 'admin' && order.cancellation_reason_label && (
            <div className="cancellation-info-box">
              <div className="cancellation-info-label">
                {order.cancellation_reason_label}
              </div>
              {order.cancellation_note && (
                <div className="cancellation-info-note">
                  📝 {order.cancellation_note}
                </div>
              )}
              <div className="cancellation-info-by">
                لغو شده توسط کافه
              </div>
            </div>
          )}

          {order.cancelled_by === 'customer' && (
            <p style={{ color: '#766f64', marginTop: '12px' }}>
              این سفارش توسط خودت لغو شده است.
            </p>
          )}

          {!order.cancelled_by && (
            <p style={{ color: '#766f64', marginTop: '12px' }}>
              این سفارش لغو شده است.
            </p>
          )}
        </div>
      ) : (
        <div className="status-stepper">
          {STATUS_STEPS.map((step, index) => {
            const isDone = index <= currentIndex
            const isCurrent = index === currentIndex
            return (
              <div
                key={step.key}
                className={`step-item ${isDone ? 'done' : ''} ${
                  isCurrent ? 'active' : ''
                }`}
              >
                <div className="step-dot">{isDone ? step.icon : ''}</div>
                <span>{step.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* باکس اقلام سفارش */}
      <div className="info-card">
        <h3>🧾 اقلام سفارش</h3>
        {order.table_number && (
          <div
            style={{
              fontSize: '13px',
              color: '#6b4f3a',
              marginBottom: '10px',
            }}
          >
            📍 میز شماره {formatPrice(order.table_number)}
          </div>
        )}

        {order.items.map((item, idx) => (
          <div key={idx} className="info-row">
            <span>
              {formatPrice(item.quantity)} × {item.product_name}
              {item.option_name && (
                <small style={{ color: '#766f64' }}>
                  {' '}
                  ({item.option_name})
                </small>
              )}
            </span>
            <strong>
              {formatPrice(item.unit_price * item.quantity)} تومان
            </strong>
          </div>
        ))}

        {order.coupon_code && order.coupon_discount ? (
          <div className="order-payment-summary">
            <div className="info-row">
              <span>جمع اقلام:</span>
              <strong>
                {formatPrice(order.original_subtotal ?? order.subtotal)} تومان
              </strong>
            </div>
            <div className="info-row discount">
              <span>🎟️ تخفیف ({order.coupon_code}):</span>
              <strong>− {formatPrice(order.coupon_discount)} تومان</strong>
            </div>
            <div className="total-row">
              <span>قابل پرداخت</span>
              <span>{formatPrice(order.subtotal)} تومان</span>
            </div>
          </div>
        ) : (
          <div className="total-row">
            <span>جمع کل</span>
            <span>{formatPrice(order.subtotal)} تومان</span>
          </div>
        )}
      </div>

      {/* باکس اطلاعات مشتری */}
      <div className="info-card">
        <h3>👤 اطلاعات تماس</h3>
        <div className="info-row">
          <span>نام:</span>
          <strong>{order.customer_name}</strong>
        </div>
        <div className="info-row">
          <span>شماره:</span>
          <strong dir="ltr">{order.customer_phone}</strong>
        </div>
        {order.note && (
          <div className="info-row">
            <span>توضیحات:</span>
            <strong>{order.note}</strong>
          </div>
        )}
      </div>

      {/* ✅ دکمه لغو سفارش */}
      {canCancel && (
        <div className="order-cancel-section">
          <button
            type="button"
            className="order-cancel-btn"
            onClick={() => setShowCancelConfirm(true)}
            disabled={cancelling}
          >
            ❌ لغو سفارش
          </button>
          <p className="order-cancel-hint">
            ⏱ تا {formatCountdown(secondsLeft)} فرصت داری سفارشت رو لغو کنی
          </p>
        </div>
      )}

      {/* ✅ پیام موفقیت لغو */}
      {cancelSuccess && (
        <div className="order-cancel-success">
          ✅ سفارش با موفقیت لغو شد
        </div>
      )}

      {/* ✅ مودال تأیید لغو */}
      {showCancelConfirm && (
        <div
          className="modal-overlay"
          onClick={() => !cancelling && setShowCancelConfirm(false)}
        >
          <div
            className="modal-container modal-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>لغو سفارش</h2>
                <p>چرا می‌خوای سفارشت رو لغو کنی؟</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {loadingReasons ? (
                <p className="empty-admin" style={{ padding: '20px' }}>
                  ⏳ در حال بارگذاری دلایل...
                </p>
              ) : reasons.length === 0 ? (
                <p className="empty-admin" style={{ padding: '20px' }}>
                  دلیلی برای نمایش وجود ندارد. می‌تونی بدون دلیل لغو کنی.
                </p>
              ) : (
                <div className="cancel-reasons-list">
                  {reasons.map((reason) => (
                    <button
                      key={reason.id}
                      type="button"
                      className={`cancel-reason-item ${
                        selectedReasonId === reason.id ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedReasonId(reason.id)}
                      disabled={cancelling}
                    >
                      <span className="cancel-reason-icon">
                        {reason.icon || '📝'}
                      </span>
                      <span className="cancel-reason-label">
                        {reason.label}
                      </span>
                      {selectedReasonId === reason.id && (
                        <span className="cancel-reason-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="cancel-note-field">
                <label>توضیحات بیشتر (اختیاری)</label>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="اگه دوست داری بیشتر توضیح بده..."
                  rows={3}
                  disabled={cancelling}
                />
              </div>

              <div className="cancel-warning">
                ⚠️ بعد از لغو، سفارش از سیستم حذف می‌شه و قابل بازگشت نیست.
              </div>

              {cancelError && (
                <div className="checkout-error" style={{ marginTop: '12px' }}>
                  ❌ {cancelError}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#9b3c32',
                  color: '#fff',
                  border: 0,
                }}
                onClick={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? '...' : '❌ لغو سفارش'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* دکمه ثابت پایین صفحه (واتساپ) */}
      <div className="sticky-action-bar">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-whatsapp"
        >
          💬 ارسال سفارش در واتساپ
        </a>
      </div>
    </div>
  )
}

function buildWhatsAppMessage(order: Order): string {
  let msg = `سلام، سفارش جدید ثبت کردم.\n\n`
  msg += `📋 سفارش #${order.order_number}\n`
  msg += `👤 ${order.customer_name}\n`
  msg += `📞 ${order.customer_phone}\n`

  if (order.table_number) {
    msg += `📍 میز ${order.table_number}\n`
  }

  msg += `\n🧾 اقلام:\n`
  for (const item of order.items) {
    msg += `  • ${item.quantity} × ${item.product_name}`
    if (item.option_name) msg += ` (${item.option_name})`
    msg += ` - ${item.unit_price * item.quantity} تومان\n`
  }

  msg += `\n💰 جمع کل: ${order.subtotal} تومان`

  if (order.note) {
    msg += `\n\n📝 توضیحات: ${order.note}`
  }

  return msg
}