'use client'
// app/admin/components/ShiftCurrentCard.tsx
// 🎯 پچ ۷۶ — ویجت داشبورد «شیفت باز جاری»
//   تنها منبع حقیقت همان API رسمی /api/admin/shifts است (همان منبع چیپ شیفت
//   صفحهٔ سفارش‌ها) — هیچ منطق مالی جدیدی اینجا نوشته نمی‌شود تا دو نسخه از
//   هم جدا نیفتند. دکمهٔ باز/بستن شیفت هم خودِ ShiftBadge است (embed)؛ پس
//   مودال تنخواه/تحویل صندوق/مغایرت‌گیری دقیقاً همان رفتار همیشگی است.
//   کارت هر ۶۰ ثانیه خودش را تازه می‌کند + دکمهٔ ↻ دستی.
import { useCallback, useEffect, useState } from 'react'
import ShiftBadge from './ShiftBadge'

const fa = (n: number) => Math.round(Number(n) || 0).toLocaleString('fa-IR')

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
  open_orders?: number
}

export default function ShiftCurrentCard() {
  const [shift, setShift] = useState<CurrentShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/shifts', { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (r.ok && d) setShift(d.current ?? null)
      else setShift(null)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, tick])

  // هر ۶۰ ثانیه خودکار — اگر شیفت از جای دیگری باز/بسته شود اینجا هم دیده می‌شود
  useEffect(() => {
    const t = setInterval(() => {
      load()
    }, 60_000)
    return () => clearInterval(t)
  }, [load])

  const openedAt = shift
    ? new Date(shift.opened_at).toLocaleString('fa-IR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
  const t = shift?.totals
  const totalSales = t
    ? t.cash + t.card + t.online + t.transfer
    : 0

  if (loading) {
    return (
      <section className="dashboard-section">
        <h2>⏱ شیفت باز جاری</h2>
        <div className="admin-card dash-shift-empty">
          در حال بررسی وضعیت شیفت…
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-section">
      <h2>
        ⏱ شیفت باز جاری
        <small className="dash-section-note">
          وضعیت شیفت در حال اجرا — باز/بستن از همین‌جا
        </small>
      </h2>

      {!shift ? (
        <div className="admin-card dash-shift-empty">
          <p className="empty-admin">
            {failed
              ? 'دریافت وضعیت شیفت ناموفق بود — دوباره تلاش کن.'
              : 'شیفت بازی باز نیست. برای شروع، دکمهٔ «باز کردن شیفت» را بزن.'}
          </p>
          <div className="dash-shift-actions dash-shift-actions--center">
            <ShiftBadge />
            <button
              type="button"
              className="btn"
              onClick={() => setTick((x) => x + 1)}
            >
              ↻ تازه‌سازی
            </button>
          </div>
        </div>
      ) : (
        <div className="dash-shift">
          <div className="dash-shift-row">
            <span>🟢 باز شده در</span>
            <strong>{openedAt}</strong>
          </div>
          <div className="dash-shift-row">
            <span>💵 تنخواه افتتاحیه</span>
            <strong>{fa(shift.opening_float)} تومان</strong>
          </div>
          <div className="dash-shift-row">
            <span>🛒 فروش کل شیفت</span>
            <strong>{fa(totalSales)} تومان</strong>
          </div>
          <div className="dash-shift-row">
            <span>🧾 تعداد سفارش شیفت</span>
            <strong>{fa(t?.orders_count ?? 0)}</strong>
          </div>
          {(shift.open_orders ?? 0) > 0 && (
            <div className="dash-shift-row dash-shift-warn">
              <span>⚠️ سفارش بازِ تسویه‌نشده</span>
              <strong>
                {fa(shift.open_orders ?? 0)} — پول آن‌ها در صندوق نیست
              </strong>
            </div>
          )}
          <div className="dash-shift-row">
            <span>🧰 نقدی موردانتظار (تنخواه + نقدی)</span>
            <strong>{fa(shift.expected_cash)} تومان</strong>
          </div>
          <div className="dash-shift-actions">
            <ShiftBadge />
            <button
              type="button"
              className="btn"
              onClick={() => setTick((x) => x + 1)}
            >
              ↻ تازه‌سازی
            </button>
            <span className="dash-shift-hint">
              هر ۶۰ ثانیه خودکار تازه می‌شود
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
