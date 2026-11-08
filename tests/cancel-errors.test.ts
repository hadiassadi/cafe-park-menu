import { describe, it, expect } from 'vitest'
import { cancelErrorInfo } from '../lib/orders/cancel-errors'

describe('cancelErrorInfo', () => {
  it('کد معلوم → وضعیت و متن درست', () => {
    expect(cancelErrorInfo('خطا: order_not_found در جدول orders')).toEqual({
      code: 'order_not_found',
      status: 404,
      text: 'سفارش پیدا نشد',
    })
  })

  it('لغو تکراری → 409', () => {
    expect(cancelErrorInfo('already_cancelled')?.status).toBe(409)
  })

  it('رسید در انتظار بررسی → پیام مخصوص مدیر', () => {
    expect(cancelErrorInfo('pending_receipts')?.text).toContain('تأیید یا رد')
  })

  it('مشتری بدون کیف پول → پیام پیشنهاد بازگشت نقدی', () => {
    expect(cancelErrorInfo('wallet_customer_not_found')?.text).toContain('بازگشت نقدی')
  })

  it('کد ناشناخته → null (خطای عمومی 500 در لایه بالاتر)', () => {
    expect(cancelErrorInfo('some other database failure')).toBeNull()
    expect(cancelErrorInfo(undefined)).toBeNull()
  })
})
