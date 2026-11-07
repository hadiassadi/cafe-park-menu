import { describe, it, expect } from 'vitest'
import { isCouponEligible } from '../lib/coupon-utils'

// قاعده: مقدار خود محصول اولویت دارد؛ مقدار نامشخص یعنی ارث از دسته؛ پیش‌فرض شامل تخفیف
// نکته: تایپ Product فیلد را boolean|undefined می‌داند، اما ستون در دیتابیس nullable است
// و سوابیس در ران‌تایم ممکن است null بدهد؛ تابع هر دو را درست هندل می‌کند.
const elig = (v: unknown) => ({ coupon_eligible: v as boolean | undefined })

describe('isCouponEligible', () => {
  it('محصول true → همیشه شامل تخفیف حتی اگر دسته false باشد', () => {
    expect(isCouponEligible(elig(true), { coupon_eligible: false })).toBe(true)
  })

  it('محصول false → همیشه مستثنا حتی اگر دسته true باشد', () => {
    expect(isCouponEligible(elig(false), { coupon_eligible: true })).toBe(false)
  })

  it('محصول نامشخص (null ران‌تایم) + دسته false → مستثنا (ارث از دسته)', () => {
    expect(isCouponEligible(elig(null), { coupon_eligible: false })).toBe(false)
  })

  it('محصول نامشخص + دسته true → شامل تخفیف', () => {
    expect(isCouponEligible(elig(null), { coupon_eligible: true })).toBe(true)
  })

  it('محصول نامشخص + دسته نامشخص → پیش‌فرض شامل تخفیف', () => {
    expect(isCouponEligible(elig(null), { coupon_eligible: null as unknown as boolean })).toBe(true)
  })

  it('بدون دسته → پیش‌فرض شامل تخفیف', () => {
    expect(isCouponEligible(elig(null))).toBe(true)
  })

  it('فیلد undefined محصول مثل null رفتار می‌کند', () => {
    expect(isCouponEligible({}, { coupon_eligible: false })).toBe(false)
    expect(isCouponEligible({}, { coupon_eligible: true })).toBe(true)
    expect(isCouponEligible({})).toBe(true)
  })
})
