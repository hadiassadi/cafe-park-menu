import { describe, it, expect } from 'vitest'
import {
  planInputError,
  durationLabel,
  subscriptionStatusLabel,
  subscriptionSourceLabel,
  walletPurchaseError,
  formatEndsAt,
} from '../lib/subscriptions/plans'

const VALID_PLAN = {
  id: null,
  name: 'ماهانه',
  price: 100_000,
  duration_days: 30,
  discount_percent: 5,
  benefits: 'دسر هدیه',
  sort_order: 10,
  is_active: true,
}

describe('planInputError — اعتبارسنجی فرم پلن', () => {
  it('پلن سالم خطا نمی‌گیرد', () => {
    expect(planInputError(VALID_PLAN)).toBeNull()
  })

  it('نام خالی یا طولانی رد می‌شود', () => {
    expect(planInputError({ ...VALID_PLAN, name: '' })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, name: 'x'.repeat(61) })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, name: '  ماهانه  ' })).toBeNull()
  })

  it('قیمت باید عدد صحیح غیرمنفی و زیر سقف باشد', () => {
    expect(planInputError({ ...VALID_PLAN, price: -1 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, price: 1000.5 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, price: 100_000_001 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, price: 0 })).toBeNull()
    expect(planInputError({ ...VALID_PLAN, price: '100000' as unknown as number })).not.toBeNull()
  })

  it('مدت باید بین ۱ تا ۳۶۵۰ روز باشد', () => {
    expect(planInputError({ ...VALID_PLAN, duration_days: 0 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, duration_days: 3651 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, duration_days: 1 })).toBeNull()
    expect(planInputError({ ...VALID_PLAN, duration_days: 3650 })).toBeNull()
  })

  it('درصد تخفیف باید بین ۰ تا ۱۰۰ باشد', () => {
    expect(planInputError({ ...VALID_PLAN, discount_percent: -5 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, discount_percent: 101 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, discount_percent: 100 })).toBeNull()
    expect(planInputError({ ...VALID_PLAN, discount_percent: 0 })).toBeNull()
  })

  it('مزایای طولانی و ترتیب خارج از بازه رد می‌شود', () => {
    expect(planInputError({ ...VALID_PLAN, benefits: 'x'.repeat(301) })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, sort_order: -1 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, sort_order: 1000 })).not.toBeNull()
    expect(planInputError({ ...VALID_PLAN, benefits: '' })).toBeNull()
  })
})

describe('برچسب‌های فارسی', () => {
  it('durationLabel مدت را فارسی می‌سازد', () => {
    expect(durationLabel(30)).toBe('۳۰ روزه')
    expect(durationLabel(7)).toBe('۷ روزه')
    expect(durationLabel(0)).toBe('۱ روزه')
  })

  it('وضعیت و منبع اشتراک برچسب دارد', () => {
    expect(subscriptionStatusLabel('active')).toBe('فعال')
    expect(subscriptionStatusLabel('expired')).toBe('منقضی')
    expect(subscriptionStatusLabel('cancelled')).toBe('لغوشده')
    expect(subscriptionStatusLabel('unknown')).toBe('unknown')
    expect(subscriptionSourceLabel('wallet')).toBe('خرید با کیف پول')
    expect(subscriptionSourceLabel('card_to_card')).toBe('خرید با تأیید رسید')
    expect(subscriptionSourceLabel('admin')).toBe('اعطای ادمین')
  })
})

describe('walletPurchaseError — گارد دکمه‌ی خرید کیف‌پولی', () => {
  const base = {
    balance: 500_000,
    price: 100_000,
    hasActiveSubscription: false,
    subscriptionEnabled: true,
    hasCustomer: true,
  }

  it('خرید مجاز خطا نمی‌دهد', () => {
    expect(walletPurchaseError(base)).toBeNull()
  })

  it('سوییچ خاموش و مهمان اول مسدود می‌شود', () => {
    expect(walletPurchaseError({ ...base, subscriptionEnabled: false })).not.toBeNull()
    expect(walletPurchaseError({ ...base, hasCustomer: false })).not.toBeNull()
  })

  it('اشتراک فعال اجازه‌ی خرید دوم نمی‌دهد', () => {
    expect(walletPurchaseError({ ...base, hasActiveSubscription: true })).not.toBeNull()
  })

  it('موجودی ناکافی پیام شارژ می‌دهد؛ پلن صفر همیشه قابل خرید است', () => {
    expect(walletPurchaseError({ ...base, balance: 99_999 })).not.toBeNull()
    expect(walletPurchaseError({ ...base, balance: null, price: 0 })).toBeNull()
    expect(walletPurchaseError({ ...base, balance: 100_000, price: 100_000 })).toBeNull()
  })
})

describe('formatEndsAt — تاریخ پایان برای چیپ مشتری', () => {
  it('تاریخ خالی/خراب رشته‌ی خالی می‌دهد', () => {
    expect(formatEndsAt(null)).toBe('')
    expect(formatEndsAt('')).toBe('')
    expect(formatEndsAt('not-a-date')).toBe('')
  })

  it('تاریخ معتبر رشته‌ی فارسی غیرخالی می‌دهد', () => {
    const out = formatEndsAt(new Date('2026-12-01T00:00:00Z').toISOString())
    expect(out.length).toBeGreaterThan(0)
    expect(out).toMatch(/[\u06F0-\u06F9]/)
  })
})
