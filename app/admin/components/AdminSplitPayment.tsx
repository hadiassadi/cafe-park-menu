'use client'

import { useMemo, useState } from 'react'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۰-هـ-او — پنل «پرداخت ترکیبی» سمت ادمین (مشترک بین پنل سفارش‌ها و POS)
// مبلغ باقی‌مانده بین روش‌ها تقسیم می‌شود (نقدی/کارت‌خوان/درگاه/کارت‌به‌کارت)
// یا کل مبلغ با یک روش («کل مبلغ»). هر بخش با همان API پرداخت POS ثبت می‌شود:
// POST /api/admin/orders/[id]/payment → ردیف confirmed روی دفتر + recalc.
// ─────────────────────────────────────────────

type MethodKey = 'cash' | 'card' | 'online' | 'transfer'

const METHODS: Array<{ key: MethodKey; icon: string; label: string }> = [
  { key: 'cash', icon: '💵', label: 'نقدی' },
  { key: 'card', icon: '💳', label: 'کارت‌خوان' },
  { key: 'online', icon: '🌐', label: 'درگاه آنلاین' },
  { key: 'transfer', icon: '🏦', label: 'کارت‌به‌کارت' },
]

const MIN_PART = 1_000
const fa = (n: number) => n.toLocaleString('fa-IR')

function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

type Props = {
  orderId: string
  remaining: number
  onDone: () => void
  onCancel?: () => void
}

export default function AdminSplitPayment({
  orderId,
  remaining,
  onDone,
  onCancel,
}: Props) {
  const [raws, setRaws] = useState<Record<MethodKey, string>>({
    cash: '',
    card: '',
    online: '',
    transfer: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneParts, setDoneParts] = useState<MethodKey[]>([])

  const amounts = useMemo(() => {
    const out: Record<MethodKey, number | null> = {
      cash: null,
      card: null,
      online: null,
      transfer: null,
    }
    for (const m of METHODS) {
      const n = parseInt(toEnDigits(raws[m.key]).replace(/\D/g, ''), 10)
      if (Number.isFinite(n) && n > 0) out[m.key] = Math.min(n, remaining)
    }
    return out
  }, [raws, remaining])

  const allocated = METHODS.reduce((s, m) => s + (amounts[m.key] ?? 0), 0)
  const overLimit = allocated > remaining

  function setAmount(key: MethodKey, raw: string) {
    const digits = toEnDigits(raw).replace(/\D/g, '')
    setRaws((r) => ({ ...r, [key]: digits }))
    setError(null)
  }

  function assignAll(key: MethodKey) {
    if (remaining < MIN_PART) return
    const next = { cash: '', card: '', online: '', transfer: '' } as Record<
      MethodKey,
      string
    >
    next[key] = String(remaining)
    setRaws(next)
    setError(null)
  }

  function clearRow(key: MethodKey) {
    setRaws((r) => ({ ...r, [key]: '' }))
    setError(null)
  }

  async function handleSubmit() {
    setError(null)
    if (remaining <= 0) return

    const parts = METHODS.filter((m) => (amounts[m.key] ?? 0) >= MIN_PART)
    if (parts.length === 0) {
      setError(`مبلغ هر بخش باید حداقل ${fa(MIN_PART)} تومان باشد.`)
      return
    }
    if (overLimit) {
      setError('مجموع بخش‌ها بیشتر از باقی‌مانده است.')
      return
    }

    setBusy(true)
    try {
      for (const m of parts) {
        const res = await fetch(`/api/admin/orders/${orderId}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: m.key, amount: amounts[m.key] }),
        })
        const d = await res.json().catch(() => null)
        if (!res.ok || d?.error) {
          throw new Error(d?.error || `ثبت بخش ${m.label} ناموفق بود`)
        }
        setDoneParts((p) => [...p, m.key])
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت پرداخت')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 120,
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #e3ddd2',
    font: 'inherit',
    color: '#4b443b',
    background: '#fff',
    direction: 'ltr',
    textAlign: 'left',
  }

  const chipStyle: React.CSSProperties = {
    fontSize: 11.5,
    padding: '3px 8px',
    borderRadius: 8,
    border: '1px solid #e3ddd2',
    background: '#fff',
    color: '#4b443b',
    cursor: 'pointer',
    font: 'inherit',
    whiteSpace: 'nowrap',
  }

  if (remaining <= 0) {
    return (
      <div style={{ textAlign: 'center', fontSize: 13, color: '#3f7d5c', padding: 8 }}>
        ✅ این سفارش تسویه شده است.
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px solid #e3ddd2',
        borderRadius: 10,
        padding: 10,
        background: '#fbf9f5',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
        🧩 پرداخت ترکیبی
      </div>
      <div style={{ fontSize: 11.5, color: '#766f64', marginBottom: 8 }}>
        باقی‌ماندهٔ {fa(remaining)} تومان را بین روش‌ها تقسیم کن یا «کل مبلغ» را با
        یک روش ثبت کن. هر بخش بلافاصله روی دفتر ثبت می‌شود.
      </div>

      {doneParts.length > 0 && (
        <div style={{ fontSize: 12, color: '#3f7d5c', marginBottom: 8 }}>
          ✅ {doneParts.length} بخش ثبت شد
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#9b3c32', marginBottom: 8 }}>❌ {error}</div>
      )}

      {METHODS.map((m) => (
        <div
          key={m.key}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, width: 110, fontWeight: 600 }}>
            {m.icon} {m.label}
          </span>
          <input
            value={raws[m.key]}
            onChange={(e) => setAmount(m.key, e.target.value)}
            placeholder={`مبلغ (تومان) — حداکثر ${fa(remaining)}`}
            inputMode="numeric"
            disabled={busy}
            style={inputStyle}
          />
          <button
            type="button"
            style={chipStyle}
            onClick={() => assignAll(m.key)}
            disabled={busy}
          >
            کل مبلغ
          </button>
          {(amounts[m.key] ?? 0) > 0 && (
            <button
              type="button"
              style={{ ...chipStyle, border: 'none', background: 'none' }}
              onClick={() => clearRow(m.key)}
              disabled={busy}
              aria-label="پاک کردن"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          fontWeight: 700,
          padding: '6px 8px',
          borderRadius: 8,
          background: overLimit ? '#fdecec' : '#f1ede4',
          color: overLimit ? '#9b3c32' : '#4b443b',
          marginBottom: 8,
        }}
      >
        <span>مجموع: {fa(allocated)}</span>
        <span>
          {overLimit
            ? 'بیشتر از باقی‌مانده!'
            : `باقی‌ماندهٔ بدون تخصیص: ${fa(Math.max(0, remaining - allocated))}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={busy}
          onClick={handleSubmit}
          style={{
            fontSize: 13,
            padding: '7px 14px',
            borderRadius: 8,
            border: 'none',
            background: '#2d5d3e',
            color: '#fff',
            fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
            font: 'inherit',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '⏳ در حال ثبت…' : '🧩 ثبت پرداخت ترکیبی'}
        </button>
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              fontSize: 13,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid #e3ddd2',
              background: '#fff',
              color: '#4b443b',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            انصراف
          </button>
        )}
      </div>
    </div>
  )
}
