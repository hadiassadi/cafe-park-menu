'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import UploadReceipt from './UploadReceipt'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

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
  payment_method: string | null
  payment_status: string | null
  payment_ref_id: string | null
  payment_receipt_url: string | null
  payment_note: string | null
}

const STATUS_STEPS = [
  { key: 'pending', label: 'ثبت شد', icon: '✓' },
  { key: 'confirmed', label: 'تأیید شد', icon: '✓' },
  { key: 'preparing', label: 'آماده‌سازی', icon: '⏳' },
  { key: 'ready', label: 'آماده تحویل', icon: '🔔' },
  { key: 'delivered', label: 'تحویل شد', icon: '🎉' },
]

const PAYMENT_METHODS: Record<
  string,
  { label: string; icon: string; hint: string }
> = {
  online: { label: 'پرداخت آنلاین', icon: '💳', hint: 'با کارت بانکی' },
  cash: { label: 'پرداخت نقدی', icon: '💵', hint: 'در محل' },
  card: { label: 'کارت‌خوان', icon: '💳', hint: 'در محل' },
  transfer: { label: 'واریز به حساب', icon: '🏦', hint: 'با رسید' },
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const [reasons, setReasons] = useState<
    Array<{ id: string; label: string; icon: string | null }>
  >([])
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [loadingReasons, setLoadingReasons] = useState(false)

  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null)
  const [showChangeMethod, setShowChangeMethod] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState<{
    payment_enabled: boolean
    payment_online_enabled: boolean
    payment_cash_enabled: boolean
    payment_card_enabled: boolean
    payment_transfer_enabled: boolean
  } | null>(null)

  // ✅ لود اولیه از API امن سرور
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error || 'سفارش پیدا نشد')
        } else {
          setOrder(data.order as Order)
        }
      } catch {
        setError('خطا در ارتباط با سرور')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    fetch('/api/payment/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setPaymentSettings(data))
      .catch(() => {})
  }, [])

  // ✅ بروزرسانی خودکار با API (نه Supabase)
  useEffect(() => {
    if (!order) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
        const data = await res.json()
        if (data.order) setOrder(data.order as Order)
      } catch {
        // silent fail on polling
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [id, order])

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
      if (!res.ok) throw new Error(data.error || 'خطا در لغو سفارش')

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

  async function handlePayOnline() {
    if (!order || paying) return
    setPaying(true)
    setPaymentError(null)
    setPaymentSuccess(null)

    try {
      const res = await fetch('/api/payment/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.paymentUrl) {
        throw new Error(data.error || 'خطا در شروع پرداخت')
      }
      window.location.href = data.paymentUrl
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'خطا')
      setPaying(false)
    }
  }

  async function handleChangeMethod(method: 'cash' | 'card' | 'transfer') {
    if (!order) return
    setPaying(true)
    setPaymentError(null)
    setPaymentSuccess(null)

    try {
      const res = await fetch('/api/payment/set-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در تغییر روش')

      setOrder({
        ...order,
        payment_method: method,
        payment_status: method === 'transfer' ? 'pending_review' : 'unpaid',
      })
      setShowChangeMethod(false)

      const methodLabel =
        method === 'cash' ? 'نقدی' : method === 'card' ? 'کارت‌خوان' : 'واریز به حساب'
      setPaymentSuccess(`✅ روش پرداخت به «${methodLabel}» تغییر کرد`)
      setTimeout(() => setPaymentSuccess(null), 3500)
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'خطا')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="order-detail-container" style={{ textAlign: 'center', paddingTop: '50px' }}>
        در حال بارگذاری سفارش...
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="order-detail-container" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <h1>{error || 'خطا'}</h1>
        <Link href="/" className="btn primary-btn" style={{ marginTop: '20px', display: 'inline-flex' }}>
          بازگشت به منو
        </Link>
      </div>
    )
  }

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === order.status)
  const isCancelled = order.status === 'cancelled'
  const isPaid = order.payment_status === 'paid'
  const isPendingReview = order.payment_status === 'pending_review'
  const isUnpaid = order.payment_status === 'unpaid' || !order.payment_status
  const isFailed = order.payment_status === 'failed'

  const isCash = order.payment_method === 'cash'
  const isCard = order.payment_method === 'card'
  const isOnline = order.payment_method === 'online'
  const isTransfer = order.payment_method === 'transfer'

  const needsOnlinePayment = isOnline && (isUnpaid || isFailed)
  const needsTransferReceipt = isTransfer && isPendingReview

  const showPaymentSection =
    !isCancelled &&
    !isPaid &&
    paymentSettings?.payment_enabled === true &&
    (needsOnlinePayment || needsTransferReceipt || isFailed)

  let badgeType = 'unpaid'
  let badgeText = '⏱ پرداخت نشده'
  const showBadge = !isCancelled

  if (isPaid) {
    badgeType = 'paid'
    badgeText = '✅ پرداخت شده'
  } else if (isPendingReview) {
    badgeType = 'pending'
    badgeText = '⏳ در انتظار تأیید رسید'
  } else if (isFailed) {
    badgeType = 'failed'
    badgeText = '❌ پرداخت ناموفق'
  } else if (isCash) {
    badgeType = 'in-place'
    badgeText = '💵 پرداخت در محل — نقدی'
  } else if (isCard) {
    badgeType = 'in-place'
    badgeText = '💳 پرداخت در محل — کارت‌خوان'
  } else if (isOnline) {
    badgeType = 'unpaid'
    badgeText = '⏱ پرداخت آنلاین — منتظر پرداخت'
  }

  const whatsappMessage = buildWhatsAppMessage(order)
  const whatsappUrl = `https://wa.me/989301817098?text=${encodeURIComponent(whatsappMessage)}`

  return (
    <div className="order-detail-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <Link href="/" className="btn" style={{ padding: '6px 12px' }}>← منو</Link>
        <h1 style={{ fontSize: '20px', margin: 0, color: '#29251f' }}>
          سفارش #{formatPrice(order.order_number)}
        </h1>
        <span style={{ width: '60px' }} />
      </div>

      {showBadge && (
        <div className={`order-payment-badge ${badgeType}`}>
          {badgeText}
          {isPaid && order.payment_ref_id && (
            <span className="order-payment-badge-ref" dir="ltr">
              {order.payment_ref_id}
            </span>
          )}
        </div>
      )}

      {showPaymentSection && (
        <div className="order-payment-section">
          <div className="order-payment-section-title">💳 پرداخت سفارش</div>

          {showChangeMethod ? (
            <>
              <p className="order-payment-section-desc">روش پرداخت جدید رو انتخاب کن:</p>

              {paymentError && (
                <div className="checkout-error" style={{ marginBottom: '12px' }}>❌ {paymentError}</div>
              )}

              <div className="order-payment-methods">
                {paymentSettings?.payment_online_enabled && (
                  <button type="button" className="order-payment-method-btn" onClick={() => { setShowChangeMethod(false); handlePayOnline() }} disabled={paying}>
                    <span className="order-payment-method-icon">💳</span>
                    <div><strong>پرداخت آنلاین</strong><small>زرین‌پال / آیدی‌پی</small></div>
                  </button>
                )}
                {paymentSettings?.payment_cash_enabled && (
                  <button type="button" className="order-payment-method-btn" onClick={() => handleChangeMethod('cash')} disabled={paying}>
                    <span className="order-payment-method-icon">💵</span>
                    <div><strong>پرداخت نقدی</strong><small>در محل</small></div>
                  </button>
                )}
                {paymentSettings?.payment_card_enabled && (
                  <button type="button" className="order-payment-method-btn" onClick={() => handleChangeMethod('card')} disabled={paying}>
                    <span className="order-payment-method-icon">💳</span>
                    <div><strong>کارت‌خوان</strong><small>در محل</small></div>
                  </button>
                )}
                {paymentSettings?.payment_transfer_enabled && (
                  <button type="button" className="order-payment-method-btn" onClick={() => handleChangeMethod('transfer')} disabled={paying}>
                    <span className="order-payment-method-icon">🏦</span>
                    <div><strong>واریز به حساب</strong><small>با رسید</small></div>
                  </button>
                )}
              </div>

              <button type="button" className="order-payment-btn secondary" onClick={() => { setShowChangeMethod(false); setPaymentError(null) }} disabled={paying} style={{ marginTop: '12px' }}>
                ← بازگشت
              </button>
            </>
          ) : (
            <>
              <p className="order-payment-section-desc">
                {needsTransferReceipt
                  ? `🏦 برای تکمیل سفارش، لطفاً مبلغ ${formatPrice(order.subtotal)} تومان رو واریز کن و رسید رو توی صفحه سفارش آپلود کن.`
                  : isFailed
                    ? 'پرداخت قبلی ناموفق بود. می‌تونی دوباره امتحان کنی یا روش دیگه‌ای انتخاب کنی.'
                    : 'برای نهایی شدن سفارش، لطفاً پرداخت رو انجام بده.'}
              </p>

              {paymentError && (
                <div className="checkout-error" style={{ marginBottom: '12px' }}>❌ {paymentError}</div>
              )}

              {paymentSuccess && (
                <div className="admin-message" style={{ marginBottom: '12px' }}>{paymentSuccess}</div>
              )}

              {needsTransferReceipt && (
                <UploadReceipt
                  orderId={order.id}
                  onSuccess={(url, note) => {
                    setOrder({
                      ...order,
                      payment_status: 'pending_review',
                      payment_receipt_url: url || order.payment_receipt_url,
                    } as any)
                  }}
                />
              )}

              <div className="order-payment-actions" style={{ marginTop: '12px' }}>
                {needsOnlinePayment && paymentSettings?.payment_online_enabled && (
                  <button type="button" className="order-payment-btn primary" onClick={handlePayOnline} disabled={paying}>
                    {paying ? '...' : `💳 پرداخت آنلاین ${formatPrice(order.subtotal)} تومان`}
                  </button>
                )}
                <button type="button" className="order-payment-btn secondary" onClick={() => { setShowChangeMethod(true); setPaymentError(null); setPaymentSuccess(null) }} disabled={paying}>
                  🔀 تغییر روش پرداخت
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isCancelled ? (
        <div className="info-card" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: 48 }}>❌</div>
          <h2 style={{ color: '#9b3c32' }}>سفارش لغو شد</h2>
          {order.cancelled_by === 'admin' && order.cancellation_reason_label && (
            <div className="cancellation-info-box">
              <div className="cancellation-info-label">{order.cancellation_reason_label}</div>
              {order.cancellation_note && (
                <div className="cancellation-info-note">📝 {order.cancellation_note}</div>
              )}
              <div className="cancellation-info-by">لغو شده توسط کافه</div>
            </div>
          )}
          {order.cancelled_by === 'customer' && (
            <p style={{ color: '#766f64', marginTop: '12px' }}>این سفارش توسط خودت لغو شده است.</p>
          )}
          {!order.cancelled_by && (
            <p style={{ color: '#766f64', marginTop: '12px' }}>این سفارش لغو شده است.</p>
          )}
        </div>
      ) : (
        <div className="status-stepper">
          {STATUS_STEPS.map((step, index) => {
            const isDone = index <= currentIndex
            const isCurrent = index === currentIndex
            return (
              <div key={step.key} className={`step-item ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}>
                <div className="step-dot">{isDone ? step.icon : ''}</div>
                <span>{step.label}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="info-card">
        <h3>🧾 اقلام سفارش</h3>
        {order.table_number && (
          <div style={{ fontSize: '13px', color: '#6b4f3a', marginBottom: '10px' }}>
            📍 میز شماره {formatPrice(order.table_number)}
          </div>
        )}
        {order.items.map((item, idx) => (
          <div key={idx} className="info-row">
            <span>
              {formatPrice(item.quantity)} × {item.product_name}
              {item.option_name && <small style={{ color: '#766f64' }}> ({item.option_name})</small>}
            </span>
            <strong>{formatPrice(item.unit_price * item.quantity)} تومان</strong>
          </div>
        ))}
        {order.coupon_code && order.coupon_discount ? (
          <div className="order-payment-summary">
            <div className="info-row">
              <span>جمع اقلام:</span>
              <strong>{formatPrice(order.original_subtotal ?? order.subtotal)} تومان</strong>
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

      <div className="info-card">
        <h3>👤 اطلاعات تماس</h3>
        <div className="info-row"><span>نام:</span><strong>{order.customer_name}</strong></div>
        <div className="info-row"><span>شماره:</span><strong dir="ltr">{order.customer_phone}</strong></div>
        {order.note && (
          <div className="info-row"><span>توضیحات:</span><strong>{order.note}</strong></div>
        )}
      </div>

      {canCancel && !isPaid && (
        <div className="order-cancel-section">
          <button type="button" className="order-cancel-btn" onClick={() => setShowCancelConfirm(true)} disabled={cancelling}>
            ❌ لغو سفارش
          </button>
          <p className="order-cancel-hint">
            ⏱ تا {formatCountdown(secondsLeft)} فرصت داری سفارشت رو لغو کنی
          </p>
        </div>
      )}

      {cancelSuccess && (
        <div className="order-cancel-success">✅ سفارش با موفقیت لغو شد</div>
      )}

      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => !cancelling && setShowCancelConfirm(false)}>
          <div className="modal-container modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>لغو سفارش</h2>
                <p>چرا می‌خوای سفارشت رو لغو کنی؟</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowCancelConfirm(false)} disabled={cancelling}>✕</button>
            </div>
            <div className="modal-body">
              {loadingReasons ? (
                <p className="empty-admin" style={{ padding: '20px' }}>⏳ در حال بارگذاری دلایل...</p>
              ) : reasons.length === 0 ? (
                <p className="empty-admin" style={{ padding: '20px' }}>دلیلی برای نمایش وجود ندارد. می‌تونی بدون دلیل لغو کنی.</p>
              ) : (
                <div className="cancel-reasons-list">
                  {reasons.map((reason) => (
                    <button key={reason.id} type="button" className={`cancel-reason-item ${selectedReasonId === reason.id ? 'selected' : ''}`} onClick={() => setSelectedReasonId(reason.id)} disabled={cancelling}>
                      <span className="cancel-reason-icon">{reason.icon || '📝'}</span>
                      <span className="cancel-reason-label">{reason.label}</span>
                      {selectedReasonId === reason.id && <span className="cancel-reason-check">✓</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="cancel-note-field">
                <label>توضیحات بیشتر (اختیاری)</label>
                <textarea value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="اگه دوست داری بیشتر توضیح بده..." rows={3} disabled={cancelling} />
              </div>
              <div className="cancel-warning">⚠️ بعد از لغو، سفارش از سیستم حذف می‌شه و قابل بازگشت نیست.</div>
              {cancelError && <div className="checkout-error" style={{ marginTop: '12px' }}>❌ {cancelError}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setShowCancelConfirm(false)} disabled={cancelling}>انصراف</button>
              <button type="button" className="btn" style={{ background: '#9b3c32', color: '#fff', border: 0 }} onClick={handleCancelOrder} disabled={cancelling}>
                {cancelling ? '...' : '❌ لغو سفارش'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky-action-bar">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
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
  if (order.table_number) msg += `📍 میز ${order.table_number}\n`
  msg += `\n🧾 اقلام:\n`
  for (const item of order.items) {
    msg += `  • ${item.quantity} × ${item.product_name}`
    if (item.option_name) msg += ` (${item.option_name})`
    msg += ` - ${item.unit_price * item.quantity} تومان\n`
  }
  msg += `\n💰 جمع کل: ${order.subtotal} تومان`
  if (order.note) msg += `\n\n📝 توضیحات: ${order.note}`
  return msg
}