import { describe, it, expect } from 'vitest'
import {
  OTP_MAX_ATTEMPTS,
  checkOtpRow,
  generateOtpCode,
  isValidIranMobile,
  normalizePhone,
  otpRejectMessage,
  phoneHash,
  type OtpRow,
} from '../lib/sms/otp'

// هش‌ها به HASH_SALT نیاز دارند (حداقل ۳۲ کاراکتر) — خوانده‌شدنش lazy است
process.env.HASH_SALT ||= 'vitest-hash-salt-0123456789abcdef'

function row(over: Partial<OtpRow> = {}): OtpRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code_hash: phoneHash('123456'),
    attempts: 0,
    used: false,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    ...over,
  }
}

describe('normalizePhone', () => {
  it('ارقام فارسی و عربی را به فرمت استاندارد می‌برد', () => {
    expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
    expect(normalizePhone('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789')
  })
  it('پیش‌کد کشور و بدون صفر را هندل می‌کند', () => {
    expect(normalizePhone('+989123456789')).toBe('09123456789')
    expect(normalizePhone('989123456789')).toBe('09123456789')
    expect(normalizePhone('9123456789')).toBe('09123456789')
  })
  it('نویز و کاراکتر اضافه را دور می‌ریزد', () => {
    expect(normalizePhone(' 0912 345 6789 ')).toBe('09123456789')
    expect(normalizePhone('09123456789#ext')).toBe('09123456789')
  })
})

describe('isValidIranMobile', () => {
  it('فرمت درست را قبول می‌کند', () => {
    expect(isValidIranMobile('09123456789')).toBe(true)
    expect(isValidIranMobile('09012345678')).toBe(true)
  })
  it('طول و پیش‌وند اشتباه را رد می‌کند', () => {
    expect(isValidIranMobile(normalizePhone('0912345678'))).toBe(false) // ۹ رقم
    expect(isValidIranMobile(normalizePhone('091234567890'))).toBe(false) // ۱۱ رقم
    expect(isValidIranMobile(normalizePhone('05123456789'))).toBe(false) // خط ثابت
    expect(isValidIranMobile('abc')).toBe(false)
    expect(isValidIranMobile('')).toBe(false)
  })
})

describe('generateOtpCode', () => {
  it('کد ۶ رقمی تولید می‌کند', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateOtpCode()
      expect(c).toMatch(/^\d{6}$/)
      expect(Number(c)).toBeGreaterThanOrEqual(100_000)
    }
  })
  it('در ۱۰۰ نمونه، تنوع منطقی دارد', () => {
    const set = new Set(Array.from({ length: 100 }, generateOtpCode))
    expect(set.size).toBeGreaterThan(90)
  })
})

describe('checkOtpRow', () => {
  it('کد درست را تأیید می‌کند', () => {
    expect(checkOtpRow(row(), '123456').ok).toBe(true)
  })
  it('کد نبوده یا مصرف‌شده را رد می‌کند', () => {
    expect(checkOtpRow(null, '123456')).toMatchObject({ ok: false, reason: 'not_found' })
    expect(checkOtpRow(row({ used: true }), '123456')).toMatchObject({ ok: false, reason: 'not_found' })
  })
  it('انقضا را می‌فهمد', () => {
    const expired = row({ expires_at: new Date(Date.now() - 1_000).toISOString() })
    expect(checkOtpRow(expired, '123456')).toMatchObject({ ok: false, reason: 'expired' })
  })
  it('کد اشتباه، شانس باقی‌مانده را حساب می‌کند', () => {
    expect(checkOtpRow(row({ attempts: 0 }), '654321')).toMatchObject({
      ok: false,
      reason: 'mismatch',
      attemptsLeft: OTP_MAX_ATTEMPTS - 1,
    })
  })
  it('بعد از سقف تلاش‌ها قفل می‌شود', () => {
    expect(checkOtpRow(row({ attempts: OTP_MAX_ATTEMPTS }), '654321')).toMatchObject({
      ok: false,
      reason: 'too_many_attempts',
    })
  })
  it('انقضا حتی با شمارنده‌ی پر، اولویت دارد', () => {
    const r = row({
      attempts: OTP_MAX_ATTEMPTS,
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    })
    expect(checkOtpRow(r, '654321')).toMatchObject({ ok: false, reason: 'expired' })
  })
})

describe('otpRejectMessage و phoneHash', () => {
  it('پیام هر علت رد شدن، معنادار است', () => {
    for (const reason of ['not_found', 'expired', 'too_many_attempts', 'mismatch'] as const) {
      expect(otpRejectMessage(reason).length).toBeGreaterThan(5)
    }
  })
  it('هش شماره، hex و حساس به رقم آخر است', () => {
    expect(phoneHash('09123456789')).toMatch(/^[0-9a-f]{64}$/)
    expect(phoneHash('09123456789')).not.toBe(phoneHash('09123456780'))
  })
})
