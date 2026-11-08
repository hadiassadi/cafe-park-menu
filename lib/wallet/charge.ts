// lib/wallet/charge.ts

/**
 * اعتبارسنجی درخواست شارژ کارت‌به‌کارت — نسخه‌ی client-safe.
 * عمداً بدون import 'server-only' تا تست‌ها و کامپوننت‌های مشتری هم استفاده کنند.
 */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** ارقام فارسی/عربی کیبورد را به انگلیسی تبدیل می‌کند */
export function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
}

/** شماره پیگیری: فقط رقم می‌ماند (خط تیره/فاصله‌ی کاربر پاک می‌شود) */
export function normalizeTrackingNo(s: string): string {
  return toEnDigits(String(s ?? '')).replace(/\D/g, '')
}

export const TRACKING_MIN_DIGITS = 4
export const TRACKING_MAX_DIGITS = 30

export function isValidTrackingNo(s: string): boolean {
  return (
    typeof s === 'string' &&
    s.length >= TRACKING_MIN_DIGITS &&
    s.length <= TRACKING_MAX_DIGITS
  )
}

/** مبلغ شارژ: عدد صحیح داخل بازه‌ی [min, max] — min/max از تنظیمات ادمین می‌آید */
export function isChargeAmount(
  v: unknown,
  min: number,
  max: number
): v is number {
  if (typeof v !== 'number' || !Number.isInteger(v)) return false
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return false
  return v >= min && v <= max
}

export const CHARGE_STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأیید شد',
  rejected: 'رد شد',
}

export function chargeStatusLabel(status: string): string {
  return CHARGE_STATUS_LABELS[status] ?? status
}

/** پیام فارسی برای رد شدن مبلغ سمت مشتری */
export function chargeAmountError(min: number, max: number): string {
  return `مبلغ باید بین ${min.toLocaleString('fa-IR')} و ${max.toLocaleString('fa-IR')} تومان باشد`
}
