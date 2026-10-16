'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function CallbackContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const orderId = searchParams.get('orderId')
  const refId = searchParams.get('refId')
  const message = searchParams.get('message')

  let icon = '❓'
  let title = 'در حال بررسی...'
  let description = 'لطفاً صبر کنید...'
  let color = '#766f64'
  let showOrder = false
  let showRetry = false

  if (status === 'success') {
    icon = '✅'
    title = 'پرداخت موفق'
    description = 'سفارش شما با موفقیت پرداخت شد.'
    color = '#477052'
    showOrder = true
  } else if (status === 'already-paid') {
    icon = '✅'
    title = 'قبلاً پرداخت شده'
    description = 'این سفارش قبلاً پرداخت شده است.'
    color = '#477052'
    showOrder = true
  } else if (status === 'cancelled') {
    icon = '❌'
    title = 'پرداخت لغو شد'
    description = 'شما پرداخت را لغو کردید. سفارش شما هنوز ثبت شده است.'
    color = '#9b3c32'
    showOrder = true
    showRetry = true
  } else if (status === 'error') {
    icon = '⚠️'
    title = 'خطا در پرداخت'
    description = message || 'متأسفانه در فرآیند پرداخت خطایی رخ داد.'
    color = '#9b3c32'
    showOrder = !!orderId
    showRetry = !!orderId
  }

  return (
    <div className="payment-callback-page">
      <div className="payment-callback-card">
        <div
          className="payment-callback-icon"
          style={{ background: color + '20', color }}
        >
          {icon}
        </div>
        <h1 style={{ color }}>{title}</h1>
        <p className="payment-callback-desc">{description}</p>

        {refId && (status === 'success' || status === 'already-paid') && (
          <div className="payment-callback-ref">
            <span>شماره پیگیری:</span>
            <strong dir="ltr">{refId}</strong>
          </div>
        )}

        <div className="payment-callback-actions">
          {showOrder && orderId && (
            <Link href={`/order/${orderId}`} className="btn primary-btn">
              {showRetry ? '💰 تلاش مجدد پرداخت' : '👁 مشاهده سفارش'}
            </Link>
          )}
          <Link href="/" className="btn">
            بازگشت به منو
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PaymentCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="payment-callback-page">
          <div className="payment-callback-card">
            <p>در حال بارگذاری...</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}