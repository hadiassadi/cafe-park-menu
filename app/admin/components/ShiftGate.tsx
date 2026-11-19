'use client'

import { useEffect, useState } from 'react'
import ShiftBadge from './ShiftBadge'

// 🎯 پچ ۵۲: دروازهٔ شیفت — بعد از ورود به پنل، اگر کاربر شیفت بازی نداشت،
// مودال «باز کردن شیفت / تحویل صندوق» خودکار باز می‌شود و هر ۶۰ ثانیه چک می‌کند.
export default function ShiftGate() {
  const [noShift, setNoShift] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const r = await fetch('/api/admin/shifts', { cache: 'no-store' })
        const d = await r.json().catch(() => null)
        if (alive && r.ok && d) setNoShift(!d.current)
      } catch {
        /* بی‌صدا — چیپ‌های صفحات خودشان وضعیت را نشان می‌دهند */
      }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  if (!noShift) return null
  return <ShiftBadge autoPrompt hideChip />
}
