// lib/subscriptions/plans.ts

/**
 * منطق خالص پلن‌های اشتراک ماهیانه — نسخه‌ی client-safe.
 * عمداً بدون import 'server-only' تا تست‌ها و کامپوننت‌های مشتری هم استفاده کنند.
 * اعتبارسنجی سروری نهایی در actions.ts پنل ادمین و RPCها تکرار می‌شود؛
 * این توابع برای فرم‌ها، دکمه‌ها و پیام‌های فارسی مشتری/ادمین است.
 */

export type SubscriptionPlan = {
  id: string
  name: string
  price: number
  duration_days: number
  discount_percent: number
  benefits: string | null
  sort_order: number
  is_active: boolean
}

export const PLAN_NAME_MAX = 60
export const PLAN_BENEFITS_MAX = 300
export const PLAN_PRICE_MAX = 100_000_000
export const PLAN_DURATION_MAX = 3650

export type PlanInput = {
  id?: string | null
  name: string
  price: number
  duration_days: number
  discount_percent: number
  benefits: string
  sort_order: number
  is_active: boolean
}

/** اعتبارسنجی فرم پلن — پیام فارسی خطا یا null یعنی سالم */
export function planInputError(input: PlanInput): string | null {
  const name = String(input?.name ?? '').trim()
  if (!name) return 'نام پلن الزامی است'
  if (name.length > PLAN_NAME_MAX) return `نام پلن حداکثر ${PLAN_NAME_MAX} نویسه است`

  const price = input?.price
  if (
    typeof price !== 'number' ||
    !Number.isInteger(price) ||
    price < 0 ||
    price > PLAN_PRICE_MAX
  ) {
    return 'قیمت پلن باید عدد صحیح بین ۰ تا ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد'
  }

  const days = input?.duration_days
  if (
    typeof days !== 'number' ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > PLAN_DURATION_MAX
  ) {
    return 'مدت اشتراک باید عدد صحیح بین ۱ تا ۳۶۵۰ روز باشد'
  }

  const percent = input?.discount_percent
  if (
    typeof percent !== 'number' ||
    !Number.isInteger(percent) ||
    percent < 0 ||
    percent > 100
  ) {
    return 'درصد تخفیف باید عدد صحیح بین ۰ تا ۱۰۰ باشد'
  }

  const benefits = String(input?.benefits ?? '').trim()
  if (benefits.length > PLAN_BENEFITS_MAX) {
    return `مزایا حداکثر ${PLAN_BENEFITS_MAX} نویسه است`
  }

  const sort = input?.sort_order
  if (typeof sort !== 'number' || !Number.isInteger(sort) || sort < 0 || sort > 999) {
    return 'ترتیب نمایش باید عددی بین ۰ تا ۹۹۹ باشد'
  }

  return null
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

const faNum = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)])

/** برچسب مدت اشتراک: ۳۰ روزه / ۹۰ روزه */
export function durationLabel(days: number): string {
  return `${faNum(Math.max(1, Math.round(days)))} روزه`
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'فعال',
  expired: 'منقضی',
  cancelled: 'لغوشده',
}

export function subscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status] ?? status
}

export const SUBSCRIPTION_SOURCE_LABELS: Record<string, string> = {
  wallet: 'خرید با کیف پول',
  card_to_card: 'خرید با تأیید رسید',
  admin: 'اعطای ادمین',
}

export function subscriptionSourceLabel(source: string): string {
  return SUBSCRIPTION_SOURCE_LABELS[source] ?? source
}

export type PurchaseGuardInput = {
  balance: number | null
  price: number
  hasActiveSubscription: boolean
  subscriptionEnabled: boolean
  hasCustomer: boolean
}

/**
 * گارد سمت مشتری برای دکمه‌ی «خرید با کیف پول» — پیام فارسی یا null یعنی مجاز.
 * (سرور با RPC همان گارد را اتمیک تکرار می‌کند؛ این فقط برای UX است.)
 */
export function walletPurchaseError(input: PurchaseGuardInput): string | null {
  if (!input.subscriptionEnabled) return 'خرید اشتراک فعلاً فعال نیست'
  if (!input.hasCustomer) return 'برای خرید اشتراک اول با شماره موبایل وارد شو'
  if (input.hasActiveSubscription) return 'شما یک اشتراک فعال دارید؛ بعد از پایان می‌توانید تمدید کنید'
  if (input.price > 0 && (input.balance == null || input.balance < input.price)) {
    return 'موجودی کیف پول برای این پلن کافی نیست؛ اول کیف پول را شارژ کن'
  }
  return null
}

/** فرمت تاریخ پایان اشتراک برای چیپ مشتری — مثل «۱۴۰۵/۰۹/۱۷» */
export function formatEndsAt(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}
