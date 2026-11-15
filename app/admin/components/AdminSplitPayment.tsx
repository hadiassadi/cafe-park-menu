'use client'

import { useMemo, useState } from 'react'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۰-هـ-وِی — پنل «پرداخت ترکیبی» ادمین، نسخهٔ فشرده
// بازطراحی بر اساس بازخورد: روش‌ها چیپ‌های کوچک تیک‌دار هستند (نه ردیف‌های
// بلند پشت‌سرهم)؛ با تیک هر روش فقط باکس مبلغ همان روش باز می‌شود.
// «کل مبلغ» روی یک روش، بقیه را غیرفعال می‌کند (پرداخت تکی).
// هر بخش با همان API پرداخت POS ثبت می‌شود:
// POST /api/admin/orders/[id]/payment → ردیف confirmed روی دفتر + recalc.
// ─────────────────────────────────────────────

type MethodKey = 'cash' | 'card' | 'online' | 'transfer'

const METHODS: Array<{ key: MethodKey; icon: string; label: string }> = [
  { key: 'cash', icon: '💵', label: 'نقدی' },
  { key: 'card', icon: '💳', label: 'کارت‌خوان' },
  { key: 'online', icon: '🌐', label: 'درگاه' },
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
  const [selected, setSelected] = useState<MethodKey[]>([])
  const [amounts, setAmounts] = useState<Partial<Record<MethodKey, number>>>({})
  const [locked, setLocked] = useState<MethodKey | null>(null) // «کل مبلغ»
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneParts, setDoneParts] = useState<MethodKey[]>([])

  const allocated = useMemo(
    () => selected.reduce((s, k) => s + (amounts[k] ?? 0), 0),
    [selected, amounts]
  )
  const overLimit = allocated > remaining

  function toggleMethod(key: MethodKey) {
    if (busy) return
    setError(null)
    setSelected((sel) => {
      if (sel.includes(key)) {
        // لغو تیک: اگر همان روش قفلِ «کل مبلغ» بود، قفل هم باز می‌شود
        setLocked((l) => (l === key ? null : l))
        setAmounts((a) => {
          const next = { ...a }
          delete next[key]
          return next
        })
        return sel.filter((k) => k !== key)
      }
      return [...sel, key]
    })
  }

  function setAmount(key: MethodKey, raw: string) {
    const digits = toEnDigits(raw).replace(/\D/g, '')
    const n = parseInt(digits, 10)
    setError(null)
    setAmounts((a) => ({
      ...a,
      [key]: Number.isFinite(n) && n > 0 ? Math.min(n, remaining) : undefined,
    }))
  }

  /** «کل مبلغ» با این روش: مبلغ را کامل می‌کند و بقیهٔ روش‌ها را غیرفعال می‌کند */
  function assignAll(key: MethodKey) {
    if (remaining < MIN_PART) return
    setError(null)
    setLocked(key)
    setSelected((sel) => sel.filter((k) => k === key))
    setAmounts({ [key]: remaining })
  }

  /** باقی‌ماندهٔ بعد از تخصیص‌های دیگر */
  function fillRest(key: MethodKey) {
    const rest = remaining - (allocated - (amounts[key] ?? 0))
    if (rest <= 0) return
    setError(null)
    setAmounts((a) => ({ ...a, [key]: rest }))
  }

  function clearRow(key: MethodKey) {
    setLocked((l) => (l === key ? null : l))
    setAmounts((a) => {
      const next = { ...a }
      delete next[key]
      return next
    })
    setError(null)
  }

  async function handleSubmit() {
    setError(null)
    if (remaining <= 0) return

    const parts = selected
      .map((k) => ({ k, amount: amounts[k] ?? 0 }))
      .filter((p) => p.amount >= MIN_PART)
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
      for (const p of parts) {
        const res = await fetch(`/api/admin/orders/${orderId}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: p.k, amount: p.amount }),
        })
        const d = await res.json().catch(() => null)
        if (!res.ok || d?.error) {
          throw new Error(
            d?.error ||
              `ثبت بخش ${METHODS.find((m) => m.key === p.k)?.label} ناموفق بود`
          )
        }
        setDoneParts((prev) => [...prev, p.k])
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت پرداخت')
    } finally {
      setBusy(false)
    }
  }

  const chipBase: React.CSSProperties = {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid #e3ddd2',
    background: '#fff',
    color: '#4b443b',
    cursor: 'pointer',
    font: 'inherit',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 110,
    fontSize: 12.5,
    padding: '5px 9px',
    borderRadius: 8,
    border: '1px solid #e3ddd2',
    font: 'inherit',
    color: '#4b443b',
    background: '#fff',
    direction: 'ltr',
    textAlign: 'left',
  }

  const miniBtn: React.CSSProperties = {
    fontSize: 11,
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
        باقی‌مانده: <b>{fa(remaining)}</b> تومان — روش‌ها را تیک بزن (چند روش =
        تقسیم مبلغ). دکمهٔ «کل مبلغ» فقط همان روش را فعال نگه می‌دارد.
      </div>

      {doneParts.length > 0 && (
        <div style={{ fontSize: 12, color: '#3f7d5c', marginBottom: 6 }}>
          ✅ {fa(doneParts.length)} بخش ثبت شد
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#9b3c32', marginBottom: 6 }}>❌ {error}</div>
      )}

      {/* ── چیپ‌های فشردهٔ روش‌ها ── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        {METHODS.map((m) => {
          const isSel = selected.includes(m.key)
          const disabled = busy || (locked !== null && !isSel)
          return (
            <button
              key={m.key}
              type="button"
              disabled={disabled}
              onClick={() => toggleMethod(m.key)}
              style={{
                ...chipBase,
                ...(isSel
                  ? { background: '#2d5d3e', borderColor: '#2d5d3e', color: '#fff' }
                  : {}),
                ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
              }}
            >
              {isSel ? '✓ ' : ''}
              {m.icon} {m.label}
              {!isSel && locked !== null ? ' 🔒' : ''}
            </button>
          )
        })}
      </div>

      {/* ── باکس مبلغ فقط برای روش‌های تیک‌خورده ── */}
      {selected.map((k) => {
        const m = METHODS.find((x) => x.key === k)!
        return (
          <div
            key={k}
            style={{
              display: 'flex',
              gap: 5,
              alignItems: 'center',
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 96 }}>
              {m.icon} {m.label}
            </span>
            <input
              value={
                amounts[k] !== undefined && amounts[k] !== null
                  ? String(amounts[k])
                  : ''
              }
              onChange={(e) => setAmount(k, e.target.value)}
              placeholder={locked === k ? String(remaining) : 'مبلغ (تومان)'}
              inputMode="numeric"
              disabled={busy}
              style={inputStyle}
            />
            <button
              type="button"
              style={miniBtn}
              onClick={() => assignAll(k)}
              disabled={busy}
              title="کل باقی‌مانده با این روش — بقیهٔ روش‌ها غیرفعال می‌شوند"
            >
              کل مبلغ
            </button>
            <button
              type="button"
              style={miniBtn}
              onClick={() => fillRest(k)}
              disabled={busy}
              title="بقیهٔ مبلغِ تخصیص‌نشده"
            >
              باقی
            </button>
            <button
              type="button"
              style={{ ...miniBtn, border: 'none', background: 'none' }}
              onClick={() => clearRow(k)}
              disabled={busy}
              aria-label="حذف روش"
            >
              ✕
            </button>
          </div>
        )
      })}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          fontWeight: 700,
          padding: '5px 8px',
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
            : `بدون تخصیص: ${fa(Math.max(0, remaining - allocated))}`}
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
          {busy ? '⏳ در حال ثبت…' : '🧩 ثبت پرداخت'}
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
