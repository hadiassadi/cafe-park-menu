import { describe, it, expect } from 'vitest'
import { isOrderVisibleToAdmin } from '../lib/orders/visibility'

// قاعده: پرداخت حضوری همیشه دیده می‌شود؛ آنلاین تا وقتی رسید/یادداشت نداشته باشد مخفی است
describe('isOrderVisibleToAdmin', () => {
  it('بدون روش پرداخت → دیده می‌شود', () => {
    expect(isOrderVisibleToAdmin({})).toBe(true)
  })

  it('نقدی/کارت‌خوان → همیشه دیده می‌شود حتی بدون وضعیت', () => {
    expect(isOrderVisibleToAdmin({ payment_method: 'cash' })).toBe(true)
    expect(isOrderVisibleToAdmin({ payment_method: 'card' })).toBe(true)
  })

  it('آنلاین پرداخت‌شده یا بخشی‌پرداخت‌شده → دیده می‌شود', () => {
    expect(isOrderVisibleToAdmin({ payment_method: 'online', payment_status: 'paid' })).toBe(true)
    expect(isOrderVisibleToAdmin({ payment_method: 'online', payment_status: 'partial' })).toBe(true)
  })

  it('آنلاین در انتظار بررسی + رسید → دیده می‌شود', () => {
    expect(
      isOrderVisibleToAdmin({
        payment_method: 'online',
        payment_status: 'pending_review',
        payment_receipt_url: 'https://x/receipt.png',
      })
    ).toBe(true)
  })

  it('آنلاین در انتظار بررسی + یادداشت متنی → دیده می‌شود', () => {
    expect(
      isOrderVisibleToAdmin({
        payment_method: 'online',
        payment_status: 'pending_review',
        payment_note: 'کارت به کارت شد',
      })
    ).toBe(true)
  })

  it('آنلاین در انتظار بررسی بدون هیچ مدرکی → مخفی', () => {
    expect(
      isOrderVisibleToAdmin({ payment_method: 'online', payment_status: 'pending_review' })
    ).toBe(false)
  })

  it('آنلاین با وضعیت دیگر → مخفی', () => {
    expect(isOrderVisibleToAdmin({ payment_method: 'online', payment_status: 'unpaid' })).toBe(
      false
    )
  })
})
