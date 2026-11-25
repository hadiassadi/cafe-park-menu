'use client'

import { useEffect, useState } from 'react'
import './admin-status-bar.css'

// 🎯 پچ ۷۰ — نوار وضعیت ثابت: تاریخ شمسی + ساعت زنده + نشان نقش
// 🎯 پچ ۷۲ — بازآرایی مطابق درخواست: «اول روز، بعد تاریخ، بعد سال» و در ادامه
//   ساعت، نام شخصِ واردشده و «آخرین ورود» همان شخص:
//   📅 چهارشنبه ۴ آذر ۱۴۰۵ · 🕐 ۱۳:۵۴ · 🪪 صاحب · مالک · ↩ آخرین ورود: امروز ۰۹:۱۵
// نام/آخرین ورود از whoami می‌آید (layout پاس می‌دهد)؛ ساعت/تاریخ بعد از mount
// پر می‌شوند تا hydration mismatch نداشته باشیم.
export default function AdminStatusBar({
  roleLabel,
  userName,
  lastLoginIso,
}: {
  roleLabel: string
  userName?: string
  lastLoginIso?: string | null
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
      // 🎯 پچ ۷۲: fa-IR پیش‌فرض «سال ماه روز» می‌چیند؛ اجزای جداگانه می‌گیریم
      // و به ترتیب درخواستی می‌چینیم: روز هفته → روز → ماه → سال
      const weekday = now.toLocaleDateString('fa-IR', {
        timeZone: 'Asia/Tehran',
        weekday: 'long',
      })
      const day = now.toLocaleDateString('fa-IR', {
        timeZone: 'Asia/Tehran',
        day: 'numeric',
      })
      const month = now.toLocaleDateString('fa-IR', {
        timeZone: 'Asia/Tehran',
        month: 'long',
      })
      const year = now.toLocaleDateString('fa-IR', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
      })
      dateFa = `${weekday} ${day} ${month} ${year}`
      timeFa = now.toLocaleTimeString('fa-IR', {
        timeZone: 'Asia/Tehran',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {}
  }

  // آخرین ورود: امروز/دیروز نسبی، وگرنه تاریخ کوتاه + ساعت
  let lastLoginFa = ''
  if (lastLoginIso) {
    try {
      const d = new Date(lastLoginIso)
      if (!isNaN(d.getTime()) && now) {
        const tehran = { timeZone: 'Asia/Tehran' } as const
        const time = d.toLocaleTimeString('fa-IR', {
          ...tehran,
          hour: '2-digit',
          minute: '2-digit',
        })
        const sameDay = (a: Date, b: Date) =>
          a.toLocaleDateString('en-CA', tehran) ===
          b.toLocaleDateString('en-CA', tehran)
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        if (sameDay(d, now)) lastLoginFa = `امروز ${time}`
        else if (sameDay(d, yesterday)) lastLoginFa = `دیروز ${time}`
        else
          lastLoginFa = `${d.toLocaleDateString('fa-IR', {
            ...tehran,
            day: 'numeric',
            month: 'long',
          })} ${time}`
      }
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
      {(userName || roleLabel) && (
        <span className="admin-status-item admin-status-badge">
          🪪 {userName}
          {userName && roleLabel ? ' · ' : ''}
          {roleLabel}
        </span>
      )}
      {lastLoginFa && (
        <span className="admin-status-item admin-status-lastlogin">
          ↩ آخرین ورود: {lastLoginFa}
        </span>
      )}
    </div>
  )
}
