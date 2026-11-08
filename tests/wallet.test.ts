import { describe, it, expect } from 'vitest'
import {
  WALLET_MAX_AMOUNT,
  WALLET_MIN_AMOUNT,
  isValidWalletAmount,
  walletKindLabel,
} from '../lib/wallet/wallet'

// هش‌ها به HASH_SALT نیاز دارند — خوانده‌شدنش lazy است
process.env.HASH_SALT ||= 'vitest-hash-salt-0123456789abcdef'

describe('isValidWalletAmount', () => {
  it('مبالغ صحیح داخل بازه را قبول می‌کند', () => {
    expect(isValidWalletAmount(WALLET_MIN_AMOUNT)).toBe(true)
    expect(isValidWalletAmount(WALLET_MAX_AMOUNT)).toBe(true)
    expect(isValidWalletAmount(200_000)).toBe(true)
  })
  it('ورودی‌های بیرون از بازه را رد می‌کند', () => {
    expect(isValidWalletAmount(WALLET_MIN_AMOUNT - 1)).toBe(false)
    expect(isValidWalletAmount(WALLET_MAX_AMOUNT + 1)).toBe(false)
    expect(isValidWalletAmount(0)).toBe(false)
    expect(isValidWalletAmount(-50_000)).toBe(false)
  })
  it('غیر عدد صحیح را رد می‌کند', () => {
    expect(isValidWalletAmount('200000')).toBe(false)
    expect(isValidWalletAmount(1500.5)).toBe(false)
    expect(isValidWalletAmount(null)).toBe(false)
    expect(isValidWalletAmount(undefined)).toBe(false)
    expect(isValidWalletAmount(Number.NaN)).toBe(false)
  })
})

describe('walletKindLabel', () => {
  it('برای همه‌ی انواع شناخته‌شده برچسب فارسی دارد', () => {
    for (const kind of ['admin_charge', 'online_charge', 'refund', 'spend']) {
      expect(walletKindLabel(kind)).not.toBe(kind)
    }
  })
  it('نوع ناشناخته را عیناً برمی‌گرداند', () => {
    expect(walletKindLabel('mystery')).toBe('mystery')
  })
})
