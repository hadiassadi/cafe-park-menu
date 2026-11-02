'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeManualRefund } from './actions'

export type PendingRefund = {
  id: string
  order_number: number | null
  amount: number
  method: string
  created_at: string
}

export default function PendingRefundsBanner({
  refunds,
}: {
  refunds: PendingRefund[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (refunds.length === 0) return null

  const total = refunds.reduce((s, r) => s + r.amount, 0)

  function done(id: string) {
    if (
      !window.confirm(
        'آیا مطمئن هستید وجه را به مشتری برگردانده‌اید؟ این کار قابل بازگشت نیست.'
      )
    )
      return
    setError('')
    setBusyId(id)
    startTransition(async () => {
      const res = await completeManualRefund(id)
      setBusyId(null)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <section
      style={{
        border: '2px solid #9b3c32',
        background: '#9b3c3212',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <h2 style={{ color: '#9b3c32', margin: '0 0 8px' }}>
        ⚠️ وجه در انتظار بازگشت به مشتری
      </h2>
      <p style={{ margin: '0 0 12px' }}>
        {refunds.length.toLocaleString('fa-IR')} مورد، جمعاً{' '}
        <strong>{total.toLocaleString('fa-IR')} تومان</strong>. این مشتری‌ها
        بعد از لغو سفارش پرداخت کرده‌اند.
      </p>

      {error && (
        <p className="danger" style={{ margin: '0 0 12px' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {refunds.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: 10,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            <span>
              سفارش #{r.order_number ?? '—'} ·{' '}
              {r.amount.toLocaleString('fa-IR')} تومان ·{' '}
              {r.method === 'gateway_manual'
                ? 'بازگشت از پنل درگاه'
                : 'نقدی'}{' '}
              ·{' '}
              {new Date(r.created_at).toLocaleString('fa-IR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            <button
              type="button"
              className="btn primary-btn"
              disabled={isPending}
              onClick={() => done(r.id)}
            >
              {busyId === r.id ? 'در حال ثبت...' : 'بازگشت وجه انجام شد'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
