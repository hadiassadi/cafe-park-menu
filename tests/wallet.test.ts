import { describe, it, expect } from 'vitest'
import {
  WALLET_MAX_AMOUNT,
  WALLET_MIN_AMOUNT,
  isValidWalletAmount,
  walletKindLabel,
} from '../lib/wallet/wallet'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  getEnabledMethods,
  isPaymentMethod,
  paymentErrorMessage,
} from '../lib/payment/methods'

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

describe('payment methods — کیف پول', () => {
  it('wallet در فهرست روش‌های پرداخت هست', () => {
    expect(PAYMENT_METHODS).toContain('wallet')
    expect(isPaymentMethod('wallet')).toBe(true)
    expect(isPaymentMethod('credit')).toBe(false)
  })

  it('برچسب فارسی کیف پول', () => {
    expect(PAYMENT_METHOD_LABELS.wallet).toBe('کیف پول')
  })

  it('getEnabledMethods فقط با پرچم فعال، wallet را برمی‌گرداند', () => {
    expect(
      getEnabledMethods({ payment_enabled: true, payment_wallet_enabled: true })
    ).toContain('wallet')
    expect(getEnabledMethods({ payment_enabled: true })).not.toContain('wallet')
    expect(
      getEnabledMethods({ payment_enabled: false, payment_wallet_enabled: true })
    ).toEqual([])
  })

  it('پیام‌های خطای پرداخت با کیف پول', () => {
    expect(paymentErrorMessage('insufficient_wallet_balance')).toContain('موجودی')
    expect(paymentErrorMessage('nothing_to_pay')).toContain('باقی نمانده')
    expect(paymentErrorMessage('wallet_customer_not_found')).toContain('کیف پول')
    expect(paymentErrorMessage('random_db_error')).toBe('خطا در ثبت پرداخت')
  })
})
