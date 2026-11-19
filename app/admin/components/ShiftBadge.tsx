'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۱ — چیپ و مودال شیفت کاری اپراتور
// 🎯 پچ ۵۲ — گردش کامل شیفت:
//   · باز کردن با «تحویل صندوق» از شیفت قبلی (تایید گیرنده / اعلام مغایرت)
//   · نمایش ساعات کاری مجاز تعریف‌شده توسط مدیر
//   · بستن کامل‌تر: فروش کل، سفارش‌های بازِ مانده، حد مغایرت،
//     «نقدی قابل تحویل به شیفت بعدی»
// autoPrompt: بدون شیفت باز، مودال خودکار باز می‌شود (دروازهٔ ShiftGate)
// hideChip: چیپ رندر نمی‌شود (فقط مودال — برای دروازه)
// ─────────────────────────────────────────────

type ShiftTotals = {
  cash: number
  card: number
  online: number
  transfer: number
  orders_count: number
}

type PreviousShift = {
  id: string
  opened_by_name: string
  closed_at: string
  announced: number
  approved: boolean
  closing_open_orders: number | null
}

type WorkWindow = { start: string; end: string }

type CurrentShift = {
  id: string
  opened_at: string
  opening_float: number
  expected_cash: number
  totals: ShiftTotals
  open_orders?: number
}

const fa = (n: number) => n.toLocaleString('fa-IR')
const TOLERANCE = 50_000 // حد مغایرت مجاز (تومان) — بالای آن در گزارش مدیر قرمز می‌شود

function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

function parseAmount(s: string): number {
  const n = Math.floor(Number(toEnDigits(s).replace(/[,\s]/g, '')))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export default function ShiftBadge({
  autoPrompt = false,
  hideChip = false,
}: {
  autoPrompt?: boolean
  hideChip?: boolean
}) {
  const [shift, setShift] = useState<CurrentShift | null>(null)
  const [previous, setPrevious] = useState<PreviousShift | null>(null)
  const [window_, setWindow_] = useState<WorkWindow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'open' | 'close'>(null)
  const [prompted, setPrompted] = useState(false)
  const [openingFloat, setOpeningFloat] = useState('')
  const [handoverMode, setHandoverMode] = useState<'accept' | 'mismatch'>('accept')
  const [handoverActual, setHandoverActual] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/shifts', { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (r.ok && d) {
        setShift(d.current ?? null)
        setPrevious(d.previous ?? null)
        setWindow_(d.window ?? null)
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

  // 🎯 پچ ۵۲: دروازه — بدون شیفت باز، مودال خودکار (یک بار تا رفرش بعدی)
  useEffect(() => {
    if (autoPrompt && !loading && !shift && !prompted) {
      setPrompted(true)
      setModal('open')
    }
  }, [autoPrompt, loading, shift, prompted])

  async function openShift() {
    setBusy(true)
    setError(null)
    try {
      const effFloat = previous
        ? handoverMode === 'accept'
          ? previous.announced
          : parseAmount(handoverActual)
        : parseAmount(openingFloat)
      const r = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_float: effFloat,
          previous_shift_id: previous?.id ?? null,
          handover_accepted: previous ? handoverMode === 'accept' : undefined,
          handover_note:
            previous && handoverMode === 'mismatch' ? handoverNote_() : null,
        }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || d?.error) {
        setError(d?.error || 'باز کردن شیفت ناموفق بود')
        return
      }
      setModal(null)
      setOpeningFloat('')
      setHandoverActual('')
      await load()
    } catch {
      setError('خطا در ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  function handoverNote_(): string {
    const base =
      handoverMode === 'mismatch'
        ? `مغایرت تحویل: اعلامی ${fa(previous?.announced ?? 0)}`
        : 'تحویل تایید شد'
    return handoverActual.trim() ? `${base} — شمارش ${fa(parseAmount(handoverActual))}` : base
  }

  async function closeShift() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counted_cash: counted.trim() === '' ? null : parseAmount(counted),
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

  const chipStyle: CSSProperties = {
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

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(30, 26, 20, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 16,
  }

  const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #d8d0c4',
    fontFamily: 'inherit',
    fontSize: 14,
  }

  const rowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#4b443b',
    padding: '5px 0',
  }

  const expected = shift?.expected_cash ?? 0
  const countedNum = counted.trim() === '' ? null : parseAmount(counted)
  const diff = countedNum === null ? null : countedNum - expected
  const diffTone =
    diff === null
      ? null
      : diff === 0
        ? { bg: '#e8f3ec', fg: '#2d5d3e', text: '✅ بدون مغایرت' }
        : Math.abs(diff) <= TOLERANCE
          ? {
              bg: '#fff4d9',
              fg: '#9a6b3f',
              text: `⚠️ مغایرت جزئی ${fa(Math.abs(diff))} تومان — در حد مجاز`,
            }
          : {
              bg: '#fdeaea',
              fg: '#9b3c32',
              text: `🚨 مغایرت بالای حد مجاز: ${diff > 0 ? 'مازاد' : 'کسری'} ${fa(Math.abs(diff))} تومان (حد: ${fa(TOLERANCE)}) — یادداشت بزن`,
            }

  const effFloat = previous
    ? handoverMode === 'accept'
      ? previous.announced
      : parseAmount(handoverActual)
    : parseAmount(openingFloat)

  return (
    <>
      {!hideChip && (
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
      )}

      {modal === 'open' && (
        <div style={overlayStyle} onClick={() => !busy && setModal(null)}>
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#2d5d3e' }}>
              ▶ باز کردن شیفت کاری
            </h3>
            <p style={{ fontSize: 12.5, color: '#766f64', margin: '0 0 10px' }}>
              از این لحظه تا بستن شیفت، همهٔ سفارش‌ها و پرداخت‌های تو با نام و کد
              خودت در همین شیفت ثبت می‌شود.
              <br />
              🕐 {window_ ? `ساعات کاری مجاز تو: ${window_.start} تا ${window_.end} (به وقت تهران)` : 'بدون محدودیت ساعات'}
            </p>

            {previous ? (
              <div
                style={{
                  border: '1px solid #e3ddd2',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  📥 تحویل صندوق از شیفت قبلی
                </div>
                <div style={{ fontSize: 12.5, color: '#766f64', marginBottom: 8 }}>
                  {previous.opened_by_name} · بسته در{' '}
                  {new Date(previous.closed_at).toLocaleString('fa-IR')}
                  {previous.approved ? ' · ✓ تاییدشده توسط مدیر' : ' · هنوز تایید نشده'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setHandoverMode('accept')}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      font: 'inherit',
                      border:
                        '1px solid ' + (handoverMode === 'accept' ? '#2d5d3e' : '#d8d0c4'),
                      background: handoverMode === 'accept' ? '#e8f3ec' : '#fff',
                      color: handoverMode === 'accept' ? '#2d5d3e' : '#4b443b',
                    }}
                  >
                    ✓ تایید و تحویل می‌گیرم
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandoverMode('mismatch')}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      font: 'inherit',
                      border:
                        '1px solid ' + (handoverMode === 'mismatch' ? '#9b3c32' : '#d8d0c4'),
                      background: handoverMode === 'mismatch' ? '#fdeaea' : '#fff',
                      color: handoverMode === 'mismatch' ? '#9b3c32' : '#4b443b',
                    }}
                  >
                    ⚠ مبلغ مغایرت دارد
                  </button>
                </div>
                {handoverMode === 'accept' ? (
                  <div style={{ fontSize: 13, color: '#2d5d3e', fontWeight: 800 }}>
                    مبلغ تحویل: {fa(previous.announced)} تومان
                  </div>
                ) : (
                  <>
                    <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                      مبلغ واقعی که الان در صندوق شمردی (تومان):
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder={String(previous.announced)}
                      value={handoverActual}
                      onChange={(e) => setHandoverActual(e.target.value)}
                      disabled={busy}
                      style={inputStyle}
                    />
                    <small style={{ fontSize: 11.5, color: '#8a8378', display: 'block', marginTop: 4 }}>
                      اختلاف با اعلامیِ {fa(previous.announced)} به‌عنوان مغایرت تحویل
                      در گزارش مدیر ثبت می‌شود.
                    </small>
                  </>
                )}
              </div>
            ) : (
              <>
                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
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
              </>
            )}

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
                {busy ? '...' : '▶ شروع شیفت'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                {autoPrompt ? 'بعداً' : 'انصراف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'close' && shift && (
        <div style={overlayStyle} onClick={() => !busy && setModal(null)}>
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#9b3c32' }}>
              🔒 بستن شیفت و تحویل صندوق
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
                <span>🛒 فروش کل شیفت</span>
                <strong>
                  {fa(
                    shift.totals.cash +
                      shift.totals.card +
                      shift.totals.online +
                      shift.totals.transfer
                  )}{' '}
                  تومان
                </strong>
              </div>
              <div style={rowStyle}>
                <span>🧾 تعداد سفارش</span>
                <strong>{fa(shift.totals.orders_count)}</strong>
              </div>
              {(shift.open_orders ?? 0) > 0 && (
                <div style={{ ...rowStyle, color: '#9a6b3f' }}>
                  <span>⚠️ سفارش بازِ تسویه‌نشده</span>
                  <strong>{fa(shift.open_orders ?? 0)} — پول آن‌ها در صندوق نیست</strong>
                </div>
              )}
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

            {diffTone && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: diffTone.bg,
                  color: diffTone.fg,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              >
                {diffTone.text}
              </div>
            )}
            <small style={{ fontSize: 11.5, color: '#8a8378', display: 'block', marginTop: 4 }}>
              همین مبلغ «نقدی قابل تحویل به شیفت بعدی» اعلام می‌شود
              {countedNum === null
                ? ` — خالی ببندی، موردانتظار (${fa(expected)}) تحویل داده می‌شود`
                : ''}
              .
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
