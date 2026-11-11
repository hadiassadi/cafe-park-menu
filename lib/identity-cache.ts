import 'server-only'

// 🎯 پچ ۴۰ — کش درون‌حافظه‌ای «هویت» (فقط اطلاعات هویتی: نام/شماره/شناسه)
// هیچ مبلغ، موجودی، تخفیف یا وضعیت پرداختی اینجا کش نمی‌شود — آن‌ها همیشه زنده از DB می‌آیند.
// TTL کوتاه + سقف تعداد ورودی (FIFO) تا حافظه رشد نکند و کهنگی محدود بماند.

type Entry = { value: unknown; exp: number }

const STORE = new Map<string, Entry>()
const MAX_ENTRIES = 300

export function identityGet<T>(key: string): T | null {
  const e = STORE.get(key)
  if (!e) return null
  if (e.exp < Date.now()) {
    STORE.delete(key)
    return null
  }
  return e.value as T
}

export function identitySet(key: string, value: unknown, ttlMs: number): void {
  if (STORE.size >= MAX_ENTRIES) {
    const oldest = STORE.keys().next().value
    if (oldest !== undefined) STORE.delete(oldest)
  }
  STORE.set(key, { value, exp: Date.now() + ttlMs })
}

export const IDENTITY_TTL = {
  /** نشست شماره تأییدشده (OTP/دعوت) → هویت مشتری */
  verifiedSession: 5 * 60_000,
  /** هش دستگاه → هویتِ آخرین سفارش (مثبت) */
  deviceIdentity: 2 * 60_000,
  /** هش دستگاه → «هیچ سفارشی نیست» (منفی، کوتاه تا سفارش اول سریع دیده شود) */
  deviceIdentityNegative: 20_000,
  /** شناسه سازمان → نام سازمان */
  orgName: 5 * 60_000,
} as const
