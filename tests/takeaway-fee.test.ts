import { describe, it, expect } from 'vitest'
import { feeForProduct, type TakeawayFee } from '../lib/orders/takeaway'

const fees = new Map<string, TakeawayFee>([
  ['fee-pack', { id: 'fee-pack', name: 'ظروف', fee: 5000 }],
  ['fee-cat', { id: 'fee-cat', name: 'دسته‌ی بیرون‌بر', fee: 3000 }],
])

describe('feeForProduct', () => {
  it('گروه خود محصول اولویت دارد', () => {
    const fee = feeForProduct(
      { takeaway_fee_id: 'fee-pack', categories: { takeaway_fee_id: 'fee-cat' } },
      fees
    )
    expect(fee?.name).toBe('ظروف')
    expect(fee?.fee).toBe(5000)
  })

  it('بدون گروه محصول → از دسته ارث می‌برد', () => {
    expect(feeForProduct({ categories: { takeaway_fee_id: 'fee-cat' } }, fees)?.fee).toBe(3000)
  })

  it('شناسه در لیست فعال نیست → null', () => {
    expect(feeForProduct({ takeaway_fee_id: 'fee-dead' }, fees)).toBeNull()
  })

  it('نه محصول و نه دسته گروهی دارند → null', () => {
    expect(feeForProduct({}, fees)).toBeNull()
  })

  it('هزینه غیر عددی به عدد تبدیل می‌شود (فقط از طریق loadActiveFees؛ اینجا ساختاری است)', () => {
    const raw = new Map([['fee-pack', { id: 'fee-pack', name: 'x', fee: Number('7000') }]])
    expect(feeForProduct({ takeaway_fee_id: 'fee-pack' }, raw)?.fee).toBe(7000)
  })
})
