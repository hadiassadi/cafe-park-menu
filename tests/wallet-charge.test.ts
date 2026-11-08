import { describe, it, expect } from 'vitest'
import {
  isChargeAmount,
  isValidTrackingNo,
  normalizeTrackingNo,
  chargeStatusLabel,
  chargeAmountError,
  TRACKING_MIN_DIGITS,
  TRACKING_MAX_DIGITS,
} from '../lib/wallet/charge'

describe('isChargeAmount — مبلغ شارژ کارت‌به‌کارت', () => {
  const min = 50_000
  const max = 10_000_000

  it('مبالغ صحیح داخل بازه را قبول می‌کند', () => {
    expect(isChargeAmount(min, min, max)).toBe(true)
    expect(isChargeAmount(max, min, max)).toBe(true)
    expect(isChargeAmount(200_000, min, max)).toBe(true)
  })

  it('کف و سقف تنظیمشده‌ی ادمین را رعایت می‌کند', () => {
    expect(isChargeAmount(30_000, 50_000, max)).toBe(false)
    expect(isChargeAmount(20_000_000, min, 10_000_000)).toBe(false)
    expect(isChargeAmount(60_000, 50_000, 55_000)).toBe(false)
  })

  it('ورودی غیر صحیح یا غیر عدد را رد می‌کند', () => {
    expect(isChargeAmount('200000', min, max)).toBe(false)
    expect(isChargeAmount(1500.5, min, max)).toBe(false)
    expect(isChargeAmount(null, min, max)).toBe(false)
    expect(isChargeAmount(undefined, min, max)).toBe(false)
    expect(isChargeAmount(Number.NaN, min, max)).toBe(false)
  })

  it('با پیکربندی خراب (min > max) هیچ عددی قبول نمی‌شود', () => {
    expect(isChargeAmount(100_000, 200_000, 100_000)).toBe(false)
  })
})

describe('normalizeTrackingNo — شماره پیگیری', () => {
  it('ارقام فارسی را به انگلیسی تبدیل می‌کند', () => {
    expect(normalizeTrackingNo('۱۲۳۴۵')).toBe('12345')
  })

  it('ارقام عربی را هم پشتیبانی می‌کند', () => {
    expect(normalizeTrackingNo('٤٥٦٧')).toBe('4567')
  })

  it('خط تیره و فاصله و حروف را پاک می‌کند', () => {
    expect(normalizeTrackingNo('1234 - 5678')).toBe('12345678')
    expect(normalizeTrackingNo('TRX 9012')).toBe('9012')
  })

  it('ورودی خالی/تعریف‌نشده رشته‌ی خالی می‌دهد', () => {
    expect(normalizeTrackingNo('')).toBe('')
    expect(normalizeTrackingNo(undefined as unknown as string)).toBe('')
  })
})

describe('isValidTrackingNo', () => {
  it('کوتاه‌تر از حداقل رقم رد می‌شود', () => {
    expect(isValidTrackingNo('1'.repeat(TRACKING_MIN_DIGITS - 1))).toBe(false)
    expect(isValidTrackingNo('123')).toBe(false)
  })

  it('طول مجاز را قبول می‌کند', () => {
    expect(isValidTrackingNo('1234')).toBe(true)
    expect(isValidTrackingNo('1'.repeat(TRACKING_MAX_DIGITS))).toBe(true)
  })

  it('بلندتر از حداکثر رقم رد می‌شود', () => {
    expect(isValidTrackingNo('1'.repeat(TRACKING_MAX_DIGITS + 1))).toBe(false)
  })
})

describe('chargeStatusLabel — برچسب وضعیت درخواست', () => {
  it('برای وضعیت‌های شناخته‌شده برچسب فارسی دارد', () => {
    expect(chargeStatusLabel('pending')).toBe('در انتظار تأیید')
    expect(chargeStatusLabel('approved')).toBe('تأیید شد')
    expect(chargeStatusLabel('rejected')).toBe('رد شد')
  })

  it('وضعیت ناشناخته را عیناً برمی‌گرداند', () => {
    expect(chargeStatusLabel('mystery')).toBe('mystery')
  })
})

describe('chargeAmountError — پیام خطای مبلغ', () => {
  it('کف و سقف را با ارقام فارسی نشان می‌دهد', () => {
    const msg = chargeAmountError(50_000, 10_000_000)
    expect(msg).toContain('۵۰٬۰۰۰')
    expect(msg).toContain('۱۰٬۰۰۰٬۰۰۰')
    expect(msg).toContain('تومان')
  })
})
