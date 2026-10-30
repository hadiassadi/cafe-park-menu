'use client'

import { useCart } from '@/lib/cart-context'
import { useEffect, useState, use } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import UploadReceipt from './UploadReceipt'
import EnablePushCard from '@/app/components/EnablePushCard'
import { formatPersianDate } from '@/lib/format-date'

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
  product_id?: string
  variant_option_id?: string
  image_url?: string
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
  customer_confirmed?: boolean
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'جدید',
  confirmed: 'تأیید شده',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده تحویل',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'پرداخت شده',
  unpaid: 'پرداخت نشده',
  pending_review: 'در انتظار تأیید',
  failed: 'ناموفق',
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
  const { addItem } = useCart()
  const [returnToCart, setReturnToCart] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const [bannerDismissed, setBannerDismissed] = useState(false)

  const [mounted, setMounted] = useState(false)
  const [printOrder, setPrintOrder] = useState<Order | null>(null)

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
  const [debtReceiptSent, setDebtReceiptSent] = useState(false)

  const [paymentSettings, setPaymentSettings] = useState<{
    payment_enabled: boolean
    payment_online_enabled: boolean
    payment_cash_enabled: boolean
    payment_card_enabled: boolean
    payment_transfer_enabled: boolean
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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
    if (!id) return
    let isMounted = true

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && data.order) {
          setOrder(data.order as Order)
        }
      } catch {}
    }, 5000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [id])

  useEffect(() => {
    if (!printOrder) return
    const handleAfterPrint = () => setPrintOrder(null)
    window.addEventListener('afterprint', handleAfterPrint)
    const timer = setTimeout(() => window.print(), 500)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printOrder])

  useEffect(() => {
    fetch('/api/payment/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setPaymentSettings(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!order || order.status !== 'pending' || order.customer_confirmed) {
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
      .catch(() => {
        if (!cancelled) setLoadingReasons(false)
      })

    return () => {
      cancelled = true
    }
  }, [showCancelConfirm, reasons.length])

  async function handleConfirmOrder() {
    if (!order) return
    setCancelling(true)
    try {
      const res = await fetch('/api/orders/customer-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      if (res.ok) {
        setOrder({ ...order, customer_confirmed: true })
        setCanCancel(false)
      } else {
        alert('خطا در نهایی کردن سفارش')
      }
    } catch {
      alert('خطا در ارتباط با سرور')
    } finally {
      setCancelling(false)
    }
  }

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
          reasonId: selectedReasonId,
          reasonLabel: selectedReason?.label || null,
          note: cancelNote.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در لغو سفارش')

      if (returnToCart && order.items) {
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
        window.location.href = '/cart'
        return
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
                payment_status: 'unpaid',
      })
      setShowChangeMethod(false)

      const methodLabel =
        (method === 'cash' || method === 'card') ? 'پرداخت در محل (نقدی/کارت‌خوان)' : 'واریز به حساب'
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
  const needsTransferReceipt = isTransfer && (isUnpaid || isPendingReview || isFailed)

  // ✅ رسید (عکس یا متن) ارسال شده و منتظر تعیین‌تکلیف مدیر هستیم
  const receiptSubmitted =
    isTransfer && isPendingReview && !!(order.payment_receipt_url || order.payment_note)
  // ✅ سفارش تحویل‌شده و تسویه‌نشده (بدهی)
  const isDebt =
    order.status === 'delivered' && !isPaid && !isCancelled
  const canPayDebtOnline =
    isDebt &&
    paymentSettings?.payment_enabled === true &&
    paymentSettings?.payment_online_enabled === true

  const showPaymentSection =
    !isCancelled &&
    !isPaid &&
    order.status !== 'delivered' &&
    paymentSettings?.payment_enabled === true &&
    (needsOnlinePayment || needsTransferReceipt || isFailed)

  const shouldShowBanner = !bannerDismissed && !isCancelled && (isPaid || isCash || isCard)


  // ✅ محاسبه تخفیف: اول از original_subtotal، اگه نبود از جمع آیتم‌ها
  const itemsSubtotal = Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
    : 0

  const originalSum = (order.original_subtotal && order.original_subtotal > order.subtotal)
                      ? order.original_subtotal
                      : itemsSubtotal

  const finalSubtotal = order.subtotal
  const discountAmount = originalSum > finalSubtotal ? (originalSum - finalSubtotal) : 0
  const hasDiscount = discountAmount > 0

  let badgeType = 'unpaid'
  let badgeText = '⏱ پرداخت نشده'
  const showBadge = !isCancelled

  if (isPaid) {
    badgeType = 'paid'
    badgeText = '✅ پرداخت شده'
  } else if (receiptSubmitted) {
    badgeType = 'pending'
    badgeText = '⏳ در انتظار تأیید رسید'
  } else if (isTransfer && (isUnpaid || isPendingReview)) {
    badgeType = 'pending'
    badgeText = '🏦 منتظر آپلود رسید'
  } else if (isFailed) {
    badgeType = 'failed'
    badgeText = '❌ پرداخت ناموفق'
  } else if (isCash || isCard) {
    badgeType = 'in-place'
    badgeText = '💵 پرداخت در محل (نقدی / کارت‌خوان)'
  } else if (isOnline) {
    badgeType = 'unpaid'
    badgeText = '⏱ پرداخت آنلاین — منتظر پرداخت'
  }

  const whatsappMessage = buildWhatsAppMessage(order)
    const isTransferPaid = isPaid && order.payment_method === 'transfer'
  const bannerOrderNo = formatPrice(order.order_number)
  const bannerTableText = order.table_number
    ? ` برای میز شماره ${formatPrice(order.table_number)}`
    : ''

  let bannerIcon = '✅'
  let bannerTitle = 'سفارش شما با موفقیت ثبت شد!'
  let bannerText = `سفارش #${bannerOrderNo}${bannerTableText} ثبت شد.`
  let bannerShowHint = true

  if (order.status === 'pending') {
    if (isTransferPaid) {
      bannerTitle = 'پرداخت شما با موفقیت تأیید شد!'
      bannerText = `رسید پرداخت سفارش #${bannerOrderNo} تأیید شد و سفارش ثبت شد.`
    } else {
      bannerTitle = 'سفارش شما با موفقیت ثبت شد!'
      bannerText = `سفارش #${bannerOrderNo}${bannerTableText} ثبت شد و منتظر تأیید است.`
    }
  } else if (order.status === 'confirmed') {
    bannerIcon = '✅'
    bannerTitle = 'سفارش شما تأیید شد'
    bannerText = `سفارش #${bannerOrderNo} تأیید شد و به‌زودی آماده‌سازی شروع می‌شود.`
  } else if (order.status === 'preparing') {
    bannerIcon = '⏳'
    bannerTitle = 'در حال آماده‌سازی'
    bannerText = `سفارش #${bannerOrderNo} در حال آماده‌سازی است.`
  } else if (order.status === 'ready') {
    bannerIcon = '🔔'
    bannerTitle = 'سفارش شما آماده است'
    bannerText = `سفارش #${bannerOrderNo} آماده تحویل است و به‌زودی به میز شما می‌رسد.`
  } else if (order.status === 'delivered') {
    bannerIcon = '🎉'
    bannerTitle = 'نوش جان!'
    bannerText = `سفارش #${bannerOrderNo} تحویل داده شد. امیدواریم لذت ببرید.`
    bannerShowHint = false
  }

  const whatsappUrl = `https://wa.me/989301817098?text=${encodeURIComponent(whatsappMessage)}`

  return (
    <div className="order-detail-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
        <Link href="/" className="btn" style={{ padding: '6px 10px', fontSize: '12px' }}>← منو</Link>
        <h1 style={{ fontSize: '18px', margin: 0, color: '#29251f', whiteSpace: 'nowrap' }}>
          سفارش #{formatPrice(order.order_number)}
        </h1>
        <Link href="/my-orders" className="btn" style={{ padding: '6px 10px', fontSize: '12px', background: '#f5f0e9', borderColor: '#d8d0c4' }}>سفارش‌های من →</Link>
      </div>

      {shouldShowBanner && (
        <div className="order-success-banner">
          <div className="order-success-icon">{bannerIcon}</div>
          <div className="order-success-body">
            <p className="order-success-title">{bannerTitle}</p>
            <p className="order-success-text">{bannerText}</p>
            {bannerShowHint && (
              <p className="order-success-hint">
                🙏 لطفاً برای جلوگیری از تداخل در سرویس‌دهی،{' '}
                <strong>میز خود را ترک نکنید</strong> و منتظر بمانید.
                می‌تونید وضعیت سفارش رو از همین صفحه پیگیری کنید.
              </p>
            )}
          </div>
          <button
            type="button"
            className="order-success-close"
            onClick={() => setBannerDismissed(true)}
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
      )}
      {!isCancelled && order && order.status !== 'delivered' && order.status !== 'cancelled' && (

        <EnablePushCard orderId={order.id} />
      )}

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
      {isDebt && (
        <div className="order-payment-section">
          <div className="order-payment-section-title">💸 این سفارش هنوز تسویه نشده است</div>
          <p className="order-payment-section-desc">
            مبلغ {formatPrice(order.subtotal)} تومان باقی مانده است.
                        {debtReceiptSent || isPendingReview
              ? ' رسید شما در انتظار تأیید مدیر است.'
              : canPayDebtOnline
                ? ' می‌تونی همین حالا آنلاین پرداخت کنی.'
                : ' لطفاً هنگام مراجعهٔ بعدی به کافه تسویه کن.'}

          </p>

          {paymentError && (
            <div className="checkout-error" style={{ marginBottom: '12px' }}>❌ {paymentError}</div>
          )}
          {canPayDebtOnline && !(debtReceiptSent || isPendingReview) && (
            <button
              type="button"
              className="order-payment-btn primary"
              onClick={handlePayOnline}
              disabled={paying}
            >
              {paying ? '...' : `💳 پرداخت آنلاین ${formatPrice(order.subtotal)} تومان`}
            </button>
          )}


                    {paymentSettings?.payment_enabled === true &&
            paymentSettings?.payment_transfer_enabled === true && (
              <div style={{ marginTop: '12px' }}>
                <p className="order-payment-section-desc">
                  🏦 یا مبلغ را واریز کن و رسید را بفرست:
                </p>
                                {debtReceiptSent || isPendingReview ? (

                  <div style={{ padding: '12px', background: '#fff7e6', color: '#8a5a00', borderRadius: '8px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>
                    ⏳ رسید شما ارسال شد و در انتظار تأیید مدیر است.
                  </div>
                ) : (
                  <UploadReceipt
                    orderId={order.id}
                    initialUrl={null}
                    onSuccess={() => setDebtReceiptSent(true)}
                  />
                )}
              </div>
            )}

        </div>
      )}


      {showPaymentSection && (
        <div className="order-payment-section">
          <div className="order-payment-section-title">💳 پرداخت سفارش</div>

          {showChangeMethod && !receiptSubmitted ? (
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
                {(paymentSettings?.payment_cash_enabled || paymentSettings?.payment_card_enabled) && (
                  <button type="button" className="order-payment-method-btn" onClick={() => handleChangeMethod('cash')} disabled={paying}>
                    <span className="order-payment-method-icon">💵</span>
                    <div><strong>پرداخت در محل</strong><small>نقدی / کارت‌خوان</small></div>
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
                {receiptSubmitted
                  ? '🏦 رسید شما دریافت شد. پس از بررسی مدیر، وضعیت پرداخت به‌روزرسانی می‌شود.'
                  : needsTransferReceipt
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
                receiptSubmitted ? (
                  <div style={{ padding: '12px', background: '#fff7e6', color: '#8a5a00', borderRadius: '8px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>
                    ⏳ رسید شما ارسال شد و در انتظار تأیید مدیر است.
                    <div style={{ fontWeight: 'normal', marginTop: '4px' }}>
                      اگر رد شود، می‌توانید دوباره رسید بفرستید یا روش پرداخت را تغییر دهید.
                    </div>
                  </div>
                ) : (
                  <UploadReceipt
                    orderId={order.id}
                    initialUrl={order.payment_receipt_url}
                    onSuccess={(url, note) => {
                      setOrder({
                        ...order,
                        payment_status: 'pending_review',
                        payment_receipt_url: url || order.payment_receipt_url,
                        payment_note: note || order.payment_note,
                      } as any)
                    }}
                  />
                )
              )}

              <div className="order-payment-actions" style={{ marginTop: '12px' }}>
                {needsOnlinePayment && paymentSettings?.payment_online_enabled && (
                  <button type="button" className="order-payment-btn primary" onClick={handlePayOnline} disabled={paying}>
                    {paying ? '...' : `💳 پرداخت آنلاین ${formatPrice(order.subtotal)} تومان`}
                  </button>
                )}
                <button
                  type="button"
                  className="order-payment-btn secondary"
                  onClick={() => { setShowChangeMethod(true); setPaymentError(null); setPaymentSuccess(null) }}
                  disabled={paying || receiptSubmitted}
                  title={receiptSubmitted ? 'تا تعیین‌تکلیف رسید امکان‌پذیر نیست' : undefined}
                >
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
                <div
                  className="step-dot"
                  style={{
                    backgroundColor: isDone ? (isCurrent ? '#d99f59' : '#477052') : '#e3ddd2',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(217, 159, 89, 0.2)' : 'none',
                    color: isDone ? '#fff' : '#aaa',
                  }}
                >
                  {isDone ? step.icon : ''}
                </div>
                <span style={{ color: isCurrent ? '#29251f' : (isDone ? '#477052' : '#766f64'), fontWeight: isCurrent ? 800 : 600 }}>
                  {step.label}
                </span>
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
              {item.option_name && (
                <small style={{ color: '#766f64' }}> ({item.option_name})</small>
              )}
            </span>
            <strong>{formatPrice(item.unit_price * item.quantity)} تومان</strong>
          </div>
        ))}

        <div className="info-row">
          <span>تاریخ ثبت:</span>
          <strong>{formatPersianDate(order.created_at)}</strong>
        </div>

        {/* ✅ بخش خلاصه پرداخت با محاسبه تخفیف */}
        {hasDiscount ? (
          <div className="order-payment-summary">
            <div className="info-row">
              <span>جمع اقلام:</span>
              <strong>{formatPrice(originalSum)} تومان</strong>
            </div>
            <div className="info-row discount">
              <span>
                {order.coupon_code && order.coupon_code !== 'MEMBERSHIP'
                  ? `🎟️ تخفیف (${order.coupon_code}):`
                  : '🎉 تخفیف باشگاه:'}
              </span>
              <strong>− {formatPrice(discountAmount)} تومان</strong>
            </div>
            <div className="total-row">
              <span>قابل پرداخت</span>
              <span>{formatPrice(finalSubtotal)} تومان</span>
            </div>
          </div>
        ) : (
          <div className="total-row">
            <span>جمع کل</span>
            <span>{formatPrice(finalSubtotal)} تومان</span>
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

      {canCancel && !isPaid && !receiptSubmitted && !order.customer_confirmed && (
        <div className="order-cancel-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#fdf9f4', padding: '16px', borderRadius: '12px', border: '1px solid #f2d5c5' }}>
          <button
            type="button"
            className="checkout-btn"
            onClick={handleConfirmOrder}
            disabled={cancelling}
            style={{ background: '#477052', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', width: '100%', fontWeight: 'bold', fontSize: '15px' }}
          >
            {cancelling ? '...' : '✅ سفارش من صحیح است (تایید مشتری)'}
          </button>

          <button type="button" className="order-cancel-btn" onClick={() => setShowCancelConfirm(true)} disabled={cancelling} style={{ border: '1px solid #e8d0cd' }}>
            ❌ لغو یا ویرایش سفارش
          </button>

          <p className="order-cancel-hint" style={{ margin: '4px 0 0 0' }}>
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

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer', fontSize: '13px', background: '#f5f0e9', padding: '10px', borderRadius: '8px' }}>
                <input type="checkbox" checked={returnToCart} onChange={(e) => setReturnToCart(e.target.checked)} disabled={cancelling} />
                <span>مایلم آیتم‌های این سفارش به سبد خرید برگردند تا بتوانم آن را اصلاح کنم.</span>
              </label>

              <div className="cancel-warning" style={{ marginTop: '12px' }}>⚠️ بعد از لغو، سفارش از سیستم حذف می‌شه و قابل بازگشت نیست.</div>
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

      <div className="sticky-action-bar" style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setPrintOrder(order)}
          className="btn"
          style={{ flex: '0 0 auto', background: '#f5f0e9', border: '1px solid #d8d0c4', color: '#29251f', borderRadius: '10px', padding: '0 16px', fontSize: '14px', fontWeight: 'bold' }}
        >
          🖨️ چاپ
        </button>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-whatsapp" style={{ flex: 1 }}>
          💬 ارسال سفارش در واتساپ
        </a>
      </div>

      {mounted && printOrder && createPortal(
        <div className="print-invoice">
          <div className="print-invoice-header">
            <h1 className="print-invoice-title">کافه پارک</h1>
            <p className="print-invoice-subtitle">
              فاکتور سفارش {printOrder.status === 'cancelled' ? '(لغو شده)' : ''}
            </p>
          </div>

          <div className="print-invoice-meta">
            <div className="print-invoice-meta-row">
              <span>شماره سفارش:</span>
              <strong>#{formatPrice(printOrder.order_number)}</strong>
            </div>
            <div className="print-invoice-meta-row">
              <span>تاریخ و ساعت:</span>
              <strong>{formatPersianDate(printOrder.created_at)}</strong>
            </div>
            <div className="print-invoice-meta-row">
              <span>وضعیت:</span>
              <strong>{STATUS_LABELS[printOrder.status]}</strong>
            </div>
            <div className="print-invoice-meta-row">
              <span>وضعیت پرداخت:</span>
              <strong>{PAYMENT_STATUS_LABELS[printOrder.payment_status || 'unpaid']}</strong>
            </div>
            {printOrder.status === 'cancelled' && printOrder.cancellation_reason_label && (
              <div className="print-invoice-meta-row">
                <span>دلیل لغو:</span>
                <strong>{printOrder.cancellation_reason_label}</strong>
              </div>
            )}
          </div>

          <div className="print-invoice-customer">
            <h3>اطلاعات مشتری</h3>
            <div className="print-invoice-meta-row">
              <span>نام:</span>
              <strong>{printOrder.customer_name}</strong>
            </div>
            <div className="print-invoice-meta-row">
              <span>شماره تماس:</span>
              <strong dir="ltr">{printOrder.customer_phone}</strong>
            </div>
            {printOrder.table_number && (
              <div className="print-invoice-meta-row">
                <span>شماره میز:</span>
                <strong>{formatPrice(printOrder.table_number)}</strong>
              </div>
            )}
            {printOrder.note && (
              <div className="print-invoice-meta-row">
                <span>توضیحات:</span>
                <strong>{printOrder.note}</strong>
              </div>
            )}
          </div>

          <div className="print-invoice-items">
            <h3>اقلام سفارش</h3>
            <table className="print-invoice-table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>#</th>
                  <th>نام محصول</th>
                  <th style={{ width: '50px', textAlign: 'center' }}>تعداد</th>
                  <th style={{ width: '100px', textAlign: 'left' }}>قیمت</th>
                </tr>
              </thead>
              <tbody>
                {printOrder.items.map((item: any, idx) => (
                  <tr key={idx}>
                    <td>{formatPrice(idx + 1)}</td>
                    <td>
                      {item.product_name}
                      {item.option_name && (
                        <small style={{ color: '#666', display: 'block' }}>({item.option_name})</small>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{formatPrice(item.quantity)}</td>
                    <td style={{ textAlign: 'left', fontWeight: 700 }}>
                      {formatPrice(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {hasDiscount ? (
                  <>
                    <tr className="invoice-summary-row">
                      <td colSpan={3}>جمع اقلام:</td>
                      <td>{formatPrice(originalSum)} تومان</td>
                    </tr>
                    <tr className="invoice-summary-row invoice-discount-row">
                      <td colSpan={3}>
                        {printOrder.coupon_code && printOrder.coupon_code !== 'MEMBERSHIP'
                          ? `🎟️ تخفیف (${printOrder.coupon_code}):`
                          : '🎉 تخفیف باشگاه:'}
                      </td>
                      <td>− {formatPrice(discountAmount)} تومان</td>
                    </tr>
                    <tr className="invoice-summary-row invoice-total-row">
                      <td colSpan={3}>قابل پرداخت:</td>
                      <td>{formatPrice(printOrder.subtotal)} تومان</td>
                    </tr>
                  </>
                ) : (
                  <tr className="invoice-summary-row invoice-total-row">
                    <td colSpan={3}>جمع کل:</td>
                    <td>{formatPrice(printOrder.subtotal)} تومان</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          <div className="print-invoice-footer">
            {printOrder.status === 'cancelled' && (
              <p style={{ color: '#dc2626', fontWeight: 'bold' }}>❌ این سفارش لغو شده است</p>
            )}
            <p>با تشکر از سفارش شما 🌹</p>
            <p className="print-invoice-footer-small">کافه پارک — پارک سلامت شیراز</p>
          </div>
        </div>,
        document.body
      )}
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
