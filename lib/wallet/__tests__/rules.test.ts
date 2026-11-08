import { describe, expect, it } from 'vitest'
import { canSpendFromWallet, otpButtonEnabled, walletAccessState } from '../rules'

describe('walletAccessState', () => {
  it('کیف پول خاموش در تنظیمات → disabled (اولویت اول)', () => {
    expect(
      walletAccessState({ walletEnabled: false, verification: 'verified', walletBlocked: false })
    ).toBe('disabled')
  })

  it('مشتری مسدودشده توسط ادمین → blocked', () => {
    expect(
      walletAccessState({ walletEnabled: true, verification: 'verified', walletBlocked: true })
    ).toBe('blocked')
  })

  it('مشتری احرازنشده → unverified', () => {
    expect(
      walletAccessState({ walletEnabled: true, verification: 'unverified', walletBlocked: false })
    ).toBe('unverified')
  })

  it('مشتری در انتظار (pending) هم مثل احرازنشده است', () => {
    expect(
      walletAccessState({ walletEnabled: true, verification: 'pending', walletBlocked: false })
    ).toBe('unverified')
  })

  it('مشتری احرازشده و فعال → active', () => {
    expect(
      walletAccessState({ walletEnabled: true, verification: 'verified', walletBlocked: false })
    ).toBe('active')
  })

  it('blocked مقدم بر unverified است', () => {
    expect(
      walletAccessState({ walletEnabled: true, verification: 'unverified', walletBlocked: true })
    ).toBe('blocked')
  })
})

describe('canSpendFromWallet', () => {
  it('فقط در حالت active خرج مجاز است', () => {
    expect(canSpendFromWallet({ walletEnabled: true, verification: 'verified', walletBlocked: false })).toBe(true)
    expect(canSpendFromWallet({ walletEnabled: true, verification: 'unverified', walletBlocked: false })).toBe(false)
    expect(canSpendFromWallet({ walletEnabled: false, verification: 'verified', walletBlocked: false })).toBe(false)
  })
})

describe('otpButtonEnabled', () => {
  it('دکمه OTP فقط با تنظیمات پیامک فعال می‌شود', () => {
    expect(otpButtonEnabled(false)).toBe(false)
    expect(otpButtonEnabled(true)).toBe(true)
  })
})
