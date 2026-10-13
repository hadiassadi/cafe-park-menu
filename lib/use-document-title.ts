'use client'

import { useEffect } from 'react'

const BASE_TITLE = 'کافه پارک — پنل مدیریت'
const ORIGINAL_FAVICON = '/icons/favicon-32x32.png'

export function useDocumentTitle(pendingCount: number) {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const link =
      (document.querySelector(
        'link[rel="icon"]'
      ) as HTMLLinkElement | null) ||
      (document.querySelector(
        'link[rel="shortcut icon"]'
      ) as HTMLLinkElement | null)

    if (pendingCount > 0) {
      // ✅ عنوان با شمارش
      document.title = `(${pendingCount.toLocaleString('fa-IR')}) ${BASE_TITLE}`

      // ✅ favicon با نقطه قرمز
      if (link) {
        link.href = generateFaviconWithBadge(pendingCount)
      }
    } else {
      document.title = BASE_TITLE
      if (link) {
        link.href = ORIGINAL_FAVICON
      }
    }

    return () => {
      document.title = BASE_TITLE
      if (link) {
        link.href = ORIGINAL_FAVICON
      }
    }
  }, [pendingCount])
}

// ✅ ساخت favicon با badge
function generateFaviconWithBadge(count: number): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx) return ORIGINAL_FAVICON

    // ─── رسم favicon اصلی ───
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = ORIGINAL_FAVICON

    // چون تصویر async لود می‌شه، از یه روش sync استفاده می‌کنیم:
    // با یه canvas خالی شروع می‌کنیم و بعد تصویر رو روش می‌کشیم
    // ولی چون canvas sync هست، فعلاً فقط یه badge قرمز می‌کشیم
    
    // ─── پس‌زمینه کرم ───
    ctx.fillStyle = '#fffdf9'
    ctx.beginPath()
    ctx.arc(16, 16, 15, 0, Math.PI * 2)
    ctx.fill()

    // ─── حرف «پ» به جای لوگو (چون تصویر async هست) ───
    ctx.fillStyle = '#6b4f3a'
    ctx.font = 'bold 18px Tahoma, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('پ', 16, 16)

    // ─── Badge قرمز ───
    const badgeX = 24
    const badgeY = 8
    const badgeRadius = 7

    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2)
    ctx.fill()

    // ─── متن تعداد ───
    const displayCount = count > 9 ? '۹+' : count.toLocaleString('fa-IR')
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px Tahoma, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(displayCount, badgeX, badgeY + 1)

    return canvas.toDataURL('image/png')
  } catch {
    return ORIGINAL_FAVICON
  }
}