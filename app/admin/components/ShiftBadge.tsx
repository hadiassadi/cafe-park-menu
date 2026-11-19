'use client'

import { useCallback, useEffect, useState } from 'react'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۱ — چیپ و مودال شیفت کاری اپراتور
// باز کردن شیفت (با تنخواه افتتاحیه) / بستن شیفت (جمع‌های زنده +
// شمارش واقعی نقدی + مغایرت خودکار). بعد از باز شدن، همهٔ سفارش‌ها و
// پرداخت‌های همان کاربر خودکار به این شیفت گره می‌خورند.
// ─────────────────────────────────────────────

type ShiftTotals = {
  cash: number
  card: number
  online: number
  transfer: number
  orders_count: number
}

type CurrentShift = {
  id: string
  opened_at: string
  opening_float: number
  expected_cash: number
  totals: ShiftTotals
}

const fa = (n: number) => n.toLocaleString('fa-IR')

function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

function parseAmount(s: string): number {
  const n = Math.floor(Number(toEnDigits(s).replace(/[,\s]/g, '')))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export default function ShiftBadge() {
  const [shift, setShift] = useState<CurrentShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'open' | 'close'>(null)
  const [openingFloat, setOpeningFloat] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/shifts', { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (r.ok && d) {
        setShift(d.current ?? null)
      } else {
        setShift(null)
      }
    } catch {
      setShift(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openShift() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_float: parseAmount(openingFloat) }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || d?.error) {
        setError(d?.error || 'باز کردن شیفت ناموفق بود')
        return
      }
      setModal(null)
      setOpeningFloat('')
      await load()
    } catch {
      setError('خطا در ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  async function closeShift() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counted_cash:
            counted.trim() === '' ? null : parseAmount(counted),
          note,
        }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || d?.error) {
        setError(d?.error || 'بستن شیفت ناموفق بود')
        return
      }
      setModal(null)
      setCounted('')
      setNote('')
      await load()
    } catch {
      setError('خطا در ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  const chipStyle: React.CSSProperties = {
    fontSize: 12.5,
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid ' + (shift ? '#2d5d3e' : '#d8d0c4'),
    background: shift ? '#2d5d3e' : '#fff',
    color: shift ? '#fff' : '#4b443b',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    boxShadow: 'none',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(30, 26, 20, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 16,
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #d8d0c4',
    fontFamily: 'inherit',
    fontSize: 14,
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#4b443b',
    padding: '5px 0',
  }

  const expected = shift?.expected_cash ?? 0
  const countedNum = counted.trim() === '' ? null : parseAmount(counted)
  const diff = countedNum === null ? null : countedNum - expected

  return (
    <>
      <button
        type="button"
        style={chipStyle}
        onClick={() => {
          setError(null)
          setModal(shift ? 'close' : 'open')
        }}
        title={shift ? 'بستن شیفت و مغایرت‌گیری' : 'باز کردن شیفت کاری'}
      >
        {loading
          ? '⏱ …'
          : shift
            ? `⏱ شیفت باز · تنخواه ${fa(shift.opening_float)}`
            : '⏱ شیفت بسته — باز کن'}
      </button>

      {modal === 'open' && (
        <div style={overlayStyle} onClick={() => !busy && setModal(null)}>
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#2d5d3e' }}>
              ▶ باز کردن شیفت کاری
            </h3>
            <p style={{ fontSize: 12.5, color: '#766f64', margin: '0 0 14px' }}>
              از این لحظه تا بستن شیفت، همهٔ سفارش‌ها و پرداخت‌های تو با نام و کد
              خودت در همین شیفت ثبت می‌شود.
            </p>
            <label
              style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}
            >
              تنخواه افتتاحیه صندوق (تومان):
            </label>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="0"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              disabled={busy}
              style={inputStyle}
            />
            <small style={{ fontSize: 11.5, color: '#8a8378', display: 'block', marginTop: 4 }}>
              پول اولیه‌ای که در صندوق می‌گذاری — خالی = صفر
            </small>
            {error && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: '#fdeaea',
                  color: '#9b3c32',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                ❌ {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn primary-btn"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={openShift}
              >
                {busy ? '...' : '▶ باز کردن شیفت'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'close' && shift && (
        <div style={overlayStyle} onClick={() => !busy && setModal(null)}>
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#9b3c32' }}>
              🔒 بستن شیفت و مغایرت‌گیری
            </h3>
            <p style={{ fontSize: 12, color: '#766f64', margin: '0 0 12px' }}>
              شیفت باز از {new Date(shift.opened_at).toLocaleString('fa-IR')}
            </p>

            <div style={{ borderTop: '1px dashed #e3ddd2', paddingTop: 8 }}>
              <div style={rowStyle}>
                <span>💵 نقدی ثبت‌شده</span>
                <strong>{fa(shift.totals.cash)} تومان</strong>
              </div>
              <div style={rowStyle}>
                <span>📟 کارت‌خوان</span>
                <strong>{fa(shift.totals.card)} تومان</strong>
              </div>
              <div style={rowStyle}>
                <span>🌐 درگاه</span>
                <strong>{fa(shift.totals.online)} تومان</strong>
              </div>
              <div style={rowStyle}>
                <span>🏦 کارت‌به‌کارت</span>
                <strong>{fa(shift.totals.transfer)} تومان</strong>
              </div>
              <div style={rowStyle}>
                <span>🛒 تعداد سفارش</span>
                <strong>{fa(shift.totals.orders_count)}</strong>
              </div>
              <div
                style={{
                  ...rowStyle,
                  borderTop: '1px dashed #e3ddd2',
                  marginTop: 4,
                  paddingTop: 8,
                  color: '#2d5d3e',
                }}
              >
                <span>🧰 نقدی موردانتظار (تنخواه + نقدی)</span>
                <strong>{fa(expected)} تومان</strong>
              </div>
            </div>

            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                display: 'block',
                margin: '12px 0 6px',
              }}
            >
              شمارش واقعی پول نقد صندوق (تومان):
            </label>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="مبلغی که الان در صندوق شمردی"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              disabled={busy}
              style={inputStyle}
            />

            {diff !== null && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: diff === 0 ? '#e8f3ec' : '#fff4d9',
                  color: diff === 0 ? '#2d5d3e' : '#9a6b3f',
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              >
                {diff === 0
                  ? '✅ بدون مغایرت'
                  : diff > 0
                    ? `⚠️ مازاد ${fa(diff)} تومان`
                    : `⚠️ کسری ${fa(Math.abs(diff))} تومان`}
              </div>
            )}
            <small style={{ fontSize: 11.5, color: '#8a8378', display: 'block', marginTop: 4 }}>
              خالی بگذاری، شیفت بدون ثبت مغایرت بسته می‌شود.
            </small>

            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                display: 'block',
                margin: '12px 0 6px',
              }}
            >
              یادداشت بستن (اختیاری):
            </label>
            <textarea
              rows={2}
              placeholder="مثلاً: فروشندهٔ ویترین ۵۰۰ هزار تومان نقدی داده"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              style={{ ...inputStyle, resize: 'vertical' }}
            />

            {error && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: '#fdeaea',
                  color: '#9b3c32',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                ❌ {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn primary-btn"
                style={{ flex: 1, background: '#9b3c32', borderColor: '#9b3c32' }}
                disabled={busy}
                onClick={closeShift}
              >
                {busy ? '...' : '🔒 بستن شیفت'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
