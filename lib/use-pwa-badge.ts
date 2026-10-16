'use client'

import { useEffect } from 'react'

/**
 * نمایش تعداد سفارش‌های pending روی آیکون PWA
 * - Chrome/Edge دسکتاپ: پشتیبانی کامل
 * - Chrome Android: پشتیبانی کامل
 * - Safari iOS: پشتیبانی نمی‌کنه (silent fail)
 */
export function usePwaBadge(count: number) {
  useEffect(() => {
    if (typeof navigator === 'undefined') return

    const nav = navigator as any

    try {
      if (count > 0 && typeof nav.setAppBadge === 'function') {
        nav.setAppBadge(count).catch(() => {})
      } else if (typeof nav.clearAppBadge === 'function') {
        nav.clearAppBadge().catch(() => {})
      }
    } catch {
      // silent fail
    }

    return () => {
      try {
        if (typeof nav.clearAppBadge === 'function') {
          nav.clearAppBadge().catch(() => {})
        }
      } catch {}
    }
  }, [count])
}