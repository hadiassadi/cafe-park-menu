// فهرست یکتای روش‌های پرداخت. هم سرور و هم کلاینت از همین فایل می‌خوانند.

export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'online'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدی',
  card: 'کارت‌خوان',
  transfer: 'کارت به کارت',
  online: 'آنلاین',
}

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v)
}

export type PaymentSettingsFlags = {
  payment_enabled?: boolean | null
  payment_cash_enabled?: boolean | null
  payment_card_enabled?: boolean | null
  payment_transfer_enabled?: boolean | null
  payment_online_enabled?: boolean | null
}

// روش‌های فعال بر اساس تنظیمات پرداخت
export function getEnabledMethods(s: PaymentSettingsFlags | null | undefined): PaymentMethod[] {
  if (!s || !s.payment_enabled) return []
  const out: PaymentMethod[] = []
  if (s.payment_cash_enabled) out.push('cash')
  if (s.payment_card_enabled) out.push('card')
  if (s.payment_transfer_enabled) out.push('transfer')
  if (s.payment_online_enabled) out.push('online')
  return out
}

// تبدیل خطای توابع SQL به پیام فارسی
export function paymentErrorMessage(raw: string | undefined | null): string {
  const m = raw ?? ''
  if (m.includes('amount_exceeds_remaining'))
    return 'مبلغ بیشتر از باقی‌مانده سفارش است (یا بخشی از آن در حال پرداخت است).'
  if (m.includes('order_closed')) return 'این سفارش لغو یا حذف شده است.'
  if (m.includes('order_not_found')) return 'سفارش پیدا نشد.'
  if (m.includes('invalid_amount')) return 'مبلغ نامعتبر است.'
  if (m.includes('payment_already_final')) return 'وضعیت این پرداخت قبلاً مشخص شده است.'
  return 'خطا در ثبت پرداخت'
}
