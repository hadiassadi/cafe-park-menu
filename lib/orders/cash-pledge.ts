import 'server-only'

/**
 * 🎯 پچ ۵۰-هـ-ص — ابزار مشترک خواندن «اعلام نقدی در محل» از یادداشت سفارش
 * (اعلام‌های پرداخت ترکیبی که پچ ۵۰-هـ-ن با /api/payment/cash-note در
 * payment_note ثبت می‌کند). بین مسیر finalize-split و GET /api/orders/[id]
 * مشترک است تا عدد اعلام‌شده در سرور و کلاینت یکسان باشد.
 */

export function faToEn(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

/** جمع «اعلام نقدی در محل: X تومان»های ثبت‌شده در یادداشت پرداخت —
 * الگوی مقاوم: هر رقمی (فارسی/عربی/انگلیسی، با هر جداکننده) بین عنوان و
 * «تومان» استخراج می‌شود. */
export function parseCashPledges(note: string | null | undefined): number {
  if (!note) return 0
  let total = 0
  const re = /اعلام نقدی در محل:\s*([^:]*?)\s*تومان/g
  let m: RegExpExecArray | null
  while ((m = re.exec(note)) !== null) {
    const n = parseInt(faToEn(m[1]).replace(/[^\d]/g, ''), 10)
    if (Number.isFinite(n) && n > 0) total += n
  }
  return total
}
