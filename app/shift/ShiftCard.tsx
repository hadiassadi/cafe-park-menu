'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

// 🎯 پچ ۶۴ — کارت شیفت موبایل: وضعیت شیفت باز/بسته + باز کردن (تنخواه/تحویل)
// و بستن (شمارش واقعی صندوق). همهٔ داده‌ها از همان API پنل (/api/admin/shifts)
// می‌آید — با جلسهٔ پنل یا توکن شیفت کارمند.

type ShiftTotals = {
  cash: number
  card: number
  online: number
  transfer: number
  orders_count: number
}

type CurrentShift = {
  id: string
  opening_float: number | string
  opened_at: string
  expected_cash?: number
  totals?: ShiftTotals
  open_orders?: number
}

type PreviousShift = {
  id: string
  opened_by_name?: string
  closed_at?: string
  announced?: number
  approved?: boolean
} | null

type DeclaredWindow = { start: string; end: string } | null

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n)

const dt = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(iso))
    : '—'

const card: CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 16,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  border: '1px solid #e5ddd0',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  borderRadius: 10,
  border: '1px solid #d8d0c4',
  padding: '10px 12px',
  fontSize: 16,
  fontFamily: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
}

const row: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 13.5,
  color: '#4b443b',
  padding: '6px 0',
  borderBottom: '1px dashed #eee4d6',
}

const primaryBtn: CSSProperties = {
  width: '100%',
  minHeight: 52,
  borderRadius: 12,
  border: 'none',
  background: '#2d5d3e',
  color: '#fff',
  fontSize: 16,
  fontWeight: 800,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const dangerBtn: CSSProperties = {
  ...primaryBtn,
  background: '#9b3c32',
}

export default function ShiftCard() {
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<CurrentShift | null>(null)
  const [previous, setPrevious] = useState<PreviousShift>(null)
  const [win, setWin] = useState<DeclaredWindow>(null)
  const [openingFloat, setOpeningFloat] = useState('')
  const [useHandover, setUseHandover] = useState(false)
  const [handoverNote, setHandoverNote] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/admin/shifts', { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d) {
        setError(d?.error ?? 'دریافت وضعیت شیفت ناموفق بود')
        setCurrent(null)
        return
      }
      setCurrent(d.current ?? null)
      setPrevious(d.previous ?? null)
      setWin(d.window ?? null)
      if (d.current) setUseHandover(false)
    } catch {
      setError('ارتباط با سرور برقرار نشد')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openShift = async () => {
    setError('')
    setResult('')
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        opening_float: openingFloat.trim() === '' ? 0 : openingFloat.trim(),
      }
      if (useHandover && previous) {
        body.previous_shift_id = previous.id
        body.handover_accepted = true
        if (handoverNote.trim()) body.handover_note = handoverNote.trim()
      }
      const r = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        setError(d?.error ?? 'باز کردن شیفت ناموفق بود')
        return
      }
      setResult('✓ شیفت باز شد — موفق باشی!')
      setOpeningFloat('')
      setHandoverNote('')
      await load()
    } catch {
      setError('ارتباط با سرور برقرار نشد')
    } finally {
      setBusy(false)
    }
  }

  const closeShift = async () => {
    setError('')
    setResult('')
    setBusy(true)
    try {
      const r = await fetch('/api/admin/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counted_cash: counted.trim() === '' ? null : counted.trim(),
          note: note.trim() || null,
        }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        setError(d?.error ?? 'بستن شیفت ناموفق بود')
        return
      }
      const disc = d?.shift?.discrepancy
      const discText =
        disc === null || disc === undefined
          ? 'بدون ثبت شمارش — مغایرت محاسبه نشد'
          : Number(disc) === 0
            ? '✅ بدون مغایرت'
            : `${Number(disc) > 0 ? 'مازاد' : 'کسری'} ${fmt(Math.abs(Number(disc)))} تومان`
      setResult(`✓ شیفت بسته شد — ${discText}`)
      setCounted('')
      setNote('')
      await load()
    } catch {
      setError('ارتباط با سرور برقرار نشد')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div style={{ ...card, textAlign: 'center', color: '#766f64', fontSize: 14 }}>
        ⏳ در حال دریافت وضعیت شیفت…
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {win && (
        <div
          style={{
            fontSize: 12.5,
            color: '#766f64',
            background: '#f6f1e9',
            borderRadius: 10,
            padding: '8px 12px',
            textAlign: 'center',
          }}
        >
          🕒 ساعات کاری اعلامی تو: <strong>{win.start}</strong> تا{' '}
          <strong>{win.end}</strong>
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 13.5,
            color: '#9b3c32',
            background: '#fbeeeb',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        >
          {error}
        </div>
      )}
      {result && (
        <div
          style={{
            fontSize: 13.5,
            color: '#2d5d3e',
            background: '#eef5f0',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        >
          {result}
        </div>
      )}

      {current ? (
        <div style={card}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#2d5d3e',
              marginBottom: 8,
            }}
          >
            🟢 شیفت باز است — از {dt(current.opened_at)}
          </div>
          <div style={row}>
            <span>🧰 تنخواه/تحویل اولیه</span>
            <strong>{fmt(Number(current.opening_float))}</strong>
          </div>
          <div style={row}>
            <span>💵 فروش نقدی</span>
            <strong>{fmt(current.totals?.cash ?? 0)}</strong>
          </div>
          <div style={row}>
            <span>💳 کارت‌خوان</span>
            <strong>{fmt(current.totals?.card ?? 0)}</strong>
          </div>
          <div style={row}>
            <span>🌐 درگاه</span>
            <strong>{fmt(current.totals?.online ?? 0)}</strong>
          </div>
          <div style={row}>
            <span>🏦 کارت‌به‌کارت</span>
            <strong>{fmt(current.totals?.transfer ?? 0)}</strong>
          </div>
          <div style={row}>
            <span>🧾 انتظاریِ صندوق</span>
            <strong>{fmt(Number(current.expected_cash ?? 0))}</strong>
          </div>
          <div
            style={{
              ...row,
              borderBottom: 'none',
            }}
          >
            <span>🛒 سفارش‌ها</span>
            <strong>{fmt(current.totals?.orders_count ?? 0)}</strong>
          </div>
          {(current.open_orders ?? 0) > 0 && (
            <div style={{ fontSize: 12.5, color: '#9a6b3f', marginTop: 4 }}>
              ⚠️ {fmt(Number(current.open_orders))} سفارش باز مانده است
            </div>
          )}

          <div
            style={{
              borderTop: '1px solid #eee4d6',
              marginTop: 10,
              paddingTop: 12,
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>
              بستن شیفت — شمارش واقعی نقدی صندوق:
            </div>
            <input
              style={inputStyle}
              dir="ltr"
              inputMode="numeric"
              placeholder="مثلاً 500000 (خالی = بدون شمارش)"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              disabled={busy}
            />
            <input
              style={{ ...inputStyle, marginTop: 8 }}
              placeholder="یادداشت (اختیاری)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              style={{ ...dangerBtn, marginTop: 12, opacity: busy ? 0.6 : 1 }}
              onClick={closeShift}
              disabled={busy}
            >
              {busy ? 'در حال ثبت…' : '🔒 بستن شیفت'}
            </button>
          </div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            🔓 شیفت بازی نداری
          </div>
          {previous && (
            <div
              style={{
                fontSize: 12.5,
                background: '#f6f1e9',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#4b443b',
                marginBottom: 12,
              }}
            >
              📥 تحویل از شیفت قبلی (
              {previous.opened_by_name ?? 'کاربر'} — {dt(previous.closed_at)}):
              اعلامی <strong>{fmt(Number(previous.announced ?? 0))}</strong> تومان
            </div>
          )}
          <input
            style={inputStyle}
            dir="ltr"
            inputMode="numeric"
            placeholder="مبلغ تنخواه/تحویل، مثلاً 500000"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            disabled={busy}
          />
          {previous && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: '#4b443b',
                marginTop: 10,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={useHandover}
                onChange={(e) => setUseHandover(e.target.checked)}
                disabled={busy}
              />
              این مبلغ را از شیفت قبلی تحویل گرفتم
            </label>
          )}
          {useHandover && (
            <input
              style={{ ...inputStyle, marginTop: 8 }}
              placeholder="یادداشت تحویل (اختیاری)"
              value={handoverNote}
              onChange={(e) => setHandoverNote(e.target.value)}
              disabled={busy}
            />
          )}
          <button
            type="button"
            style={{ ...primaryBtn, marginTop: 12, opacity: busy ? 0.6 : 1 }}
            onClick={openShift}
            disabled={busy}
          >
            {busy ? 'در حال ثبت…' : '▶ باز کردن شیفت'}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={load}
        style={{
          ...card,
          padding: '10px 16px',
          background: 'transparent',
          boxShadow: 'none',
          color: '#4a7fa5',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ⟳ به‌روزرسانی وضعیت
      </button>
    </div>
  )
}
