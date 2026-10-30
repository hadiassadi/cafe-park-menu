'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERROR_MESSAGES: Record<string, string> = {
  no_authority: 'کد تراکنش دریافت نشد.',
  bad_order: 'شناسه سفارش نامعتبر است.',
  order_not_found: 'سفارش پیدا نشد.',
  authority_mismatch: 'اطلاعات تراکنش با سفارش مطابقت ندارد.',
  bad_amount: 'مبلغ سفارش نامعتبر است.',
  settings: 'خطا در تنظیمات پرداخت.',
  verify_failed: 'تأیید پرداخت ناموفق بود.',
  save_failed:
    'پرداخت انجام شد ولی ثبت نشد. لطفاً با کافه تماس بگیرید و شماره پیگیری را اعلام کنید.',
  unexpected: 'متأسفانه در فرآیند پرداخت خطایی رخ داد.',
}

function CallbackContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const code = searchParams.get('code') || ''

  const rawOrderId = searchParams.get('orderId')
  const orderId = rawOrderId && UUID_RE.test(rawOrderId) ? rawOrderId : null

  const rawRefId = searchParams.get('refId')
  const refId = rawRefId && /^\d{1,20}$/.test(rawRefId) ? rawRefId : null

  let icon = '❓'
  let title = 'وضعیت نامشخص'
  let description = 'نتیجه پرداخت مشخص نیست. لطفاً وضعیت سفارش را بررسی کنید.'
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
    description =
      'شما پرداخت را لغو کردید. سفارش شما هنوز ثبت شده است. می‌تونی از صفحه سفارش، پرداخت رو دوباره انجام بدی.'
    color = '#9b3c32'
    showOrder = true
    showRetry = true
  } else if (status === 'pending') {
    icon = '⏳'
    title = 'تأیید پرداخت هنوز کامل نشده'
    description =
      'اگر مبلغ از حساب شما کسر شده، چند دقیقه بعد وضعیت سفارش را بررسی کنید یا با کافه تماس بگیرید. لطفاً دوباره پرداخت نکنید.'
    color = '#a8741a'
    showOrder = true
  } else if (status === 'error') {
    icon = '⚠️'
    title = 'خطا در پرداخت'
    description =
      ERROR_MESSAGES[code] ?? 'متأسفانه در فرآیند پرداخت خطایی رخ داد.'
    color = '#9b3c32'
    // پس از save_failed نباید پرداخت مجدد پیشنهاد شود
    showOrder = !!orderId
    showRetry = !!orderId && code !== 'save_failed'
  }

  const showRef =
    refId &&
    (status === 'success' ||
      status === 'already-paid' ||
      code === 'save_failed')

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

        {showRef && (
          <div className="payment-callback-ref">
            <span>شماره پیگیری:</span>
            <strong dir="ltr">{refId}</strong>
          </div>
        )}

        <div className="payment-callback-actions">
          {showOrder && orderId && (
            <Link
              href={`/order/${orderId}${showRetry ? '?retry=1' : ''}`}
              className="btn primary-btn"
            >
              {showRetry ? '🔁 تلاش مجدد پرداخت' : '👁 مشاهده سفارش'}
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
