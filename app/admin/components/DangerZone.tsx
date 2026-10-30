'use client'

import { useState, useTransition } from 'react'
import { resetData } from '../resetData'

type Sel = {
  orders: boolean
  customers: boolean
  coupons: boolean
  receipts: boolean
}

const LABELS: Record<keyof Sel, string> = {
  orders: 'سفارش‌ها',
  customers: 'مشتری‌ها (همراه با سفارش‌ها)',
  coupons: 'کوپن‌ها',
  receipts: 'فایل‌های رسید',
}

export default function DangerZone() {
  const [sel, setSel] = useState<Sel>({
    orders: false,
    customers: false,
    coupons: false,
    receipts: false,
  })
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  const anySelected = Object.values(sel).some(Boolean)
  const canRun = anySelected && confirm === 'RESET' && !pending

  function run() {
    start(async () => {
      const r = await resetData({ ...sel, confirm })
      if (r.ok) {
        setMsg('✅ انجام شد: ' + JSON.stringify(r.result) + ` · رسیدهای پاک‌شده: ${r.receiptsRemoved ?? 0}`)
        setConfirm('')
      } else {
        setMsg('❌ ' + r.error)
      }
    })
  }

  return (
    <section
      dir="rtl"
      style={{
        border: '2px solid #c0392b',
        borderRadius: 14,
        padding: 16,
        background: '#fdf6f5',
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <strong style={{ color: '#c0392b', fontSize: 16 }}>⚠️ منطقه‌ی خطر: ریست داده‌های تستی</strong>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#7a4a45' }}>
          این عملیات برگشت‌پذیر نیست. فقط قبل از افتتاح واقعی استفاده کنید.
        </p>
      </div>

      {(Object.keys(sel) as (keyof Sel)[]).map((k) => (
        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sel[k]}
            onChange={(e) => setSel({ ...sel, [k]: e.target.checked })}
          />
          {LABELS[k]}
        </label>
      ))}

      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="برای تایید، RESET را تایپ کنید"
        dir="ltr"
        autoComplete="off"
        style={{
          border: '1px solid #d9b3af',
          borderRadius: 8,
          padding: '8px 10px',
          width: '100%',
          font: 'inherit',
        }}
      />

      <button
        type="button"
        disabled={!canRun}
        onClick={run}
        style={{
          background: '#c0392b',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '10px 18px',
          font: 'inherit',
          fontWeight: 700,
          cursor: canRun ? 'pointer' : 'not-allowed',
          opacity: canRun ? 1 : 0.4,
        }}
      >
        {pending ? 'در حال اجرا...' : 'ریست'}
      </button>

      {msg && <p style={{ margin: 0, fontSize: 13, wordBreak: 'break-word' }}>{msg}</p>}
    </section>
  )
}
