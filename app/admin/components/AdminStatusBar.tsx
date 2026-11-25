'use client'

import { useEffect, useState } from 'react'
import './admin-status-bar.css'

// 🎯 پچ ۷۰ — نوار وضعیت ثابت: تاریخ شمسی + ساعت زنده + نشان نقش،
// روی یک نوار در بالای همهٔ صفحات ادمین (به‌جز صفحهٔ ثبت سفارش و لاگین —
// چون داخل nav تب‌ها رندر می‌شود و آن‌جا پنهان‌اند).
// ساعت/تاریخ فقط بعد از mount پر می‌شوند تا hydration mismatch نداشته باشیم.
export default function AdminStatusBar({
  roleLabel,
}: {
  roleLabel: string
}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    // هر ۱۵ ثانیه — نمایش دقیقه‌ای کافی است و رندر اضافه نمی‌زند
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  let dateFa = ''
  let timeFa = ''
  if (now) {
    try {
      dateFa = now.toLocaleDateString('fa-IR', {
        timeZone: 'Asia/Tehran',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      timeFa = now.toLocaleTimeString('fa-IR', {
        timeZone: 'Asia/Tehran',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {}
  }

  return (
    <div className="admin-status-row">
      {dateFa && (
        <span className="admin-status-item admin-status-date">
          📅 {dateFa}
        </span>
      )}
      {timeFa && (
        <span className="admin-status-item admin-status-time">
          🕐 {timeFa}
        </span>
      )}
      {roleLabel && (
        <span className="admin-status-badge">🪪 {roleLabel}</span>
      )}
    </div>
  )
}
