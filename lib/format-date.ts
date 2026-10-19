// lib/format-date.ts

/**
 * تبدیل تاریخ ISO به فرمت فارسی با روز هفته
 * @param isoDate تاریخ به فرمت ISO (مثلاً از دیتابیس)
 * @param opts تنظیمات اختیاری (با ساعت یا بدون ساعت)
 */
export function formatPersianDate(
  isoDate: string | Date | null | undefined,
  opts: { withTime?: boolean; withYear?: boolean } = {}
): string {
  if (!isoDate) return '—'

  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return '—'

  const { withTime = true, withYear = true } = opts

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Tehran',
  }

  if (withYear) {
    options.year = 'numeric'
  }

  // خروجی: «شنبه ۳ آبان ۱۴۰۴»
  const datePart = date.toLocaleDateString('fa-IR', options)

  if (!withTime) return datePart

  // خروجی: «۱۴:۳۰»
  const timePart = date.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tehran',
  })

  return `${datePart} — ساعت ${timePart}`
}