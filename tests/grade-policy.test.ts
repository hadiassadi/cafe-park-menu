import { describe, expect, it } from 'vitest'
import {
  combineDiscounts,
  normalizePolicy,
  pickGradeForTotal,
  type GradeLike,
} from '../lib/club/discount-policy'

const base = {
  stackCapPercent: 10,
  eligibleSubtotal: 1_000_000,
  membershipPercent: 0,
  gradePercent: 0,
}

describe('normalizePolicy', () => {
  it('مقدار نامعتبر → max (پیش‌فرض)', () => {
    expect(normalizePolicy('weird')).toBe('max')
    expect(normalizePolicy(null)).toBe('max')
    expect(normalizePolicy('stacked')).toBe('stacked')
  })
})

describe('combineDiscounts', () => {
  it('بدون هیچ تخفیفی → صفر و winner=none', () => {
    expect(combineDiscounts({ ...base, policy: 'max' })).toEqual({
      membershipDiscount: 0,
      gradeDiscount: 0,
      discount: 0,
      winner: 'none',
    })
  })

  it('فقط عضویت (رفتار قدیمی بدون گرید حفظ می‌شود)', () => {
    const r = combineDiscounts({ ...base, policy: 'max', membershipPercent: 5 })
    expect(r).toMatchObject({ membershipDiscount: 50_000, gradeDiscount: 0, discount: 50_000, winner: 'membership' })
  })

  it('سیاست max → تخفیف بزرگ‌تر برنده است', () => {
    const r = combineDiscounts({ ...base, policy: 'max', membershipPercent: 3, gradePercent: 6 })
    expect(r).toMatchObject({ membershipDiscount: 0, gradeDiscount: 60_000, discount: 60_000, winner: 'grade' })
  })

  it('سیاست max — تساوی → باشگاه (رفتار قبلی)', () => {
    const r = combineDiscounts({ ...base, policy: 'max', membershipPercent: 4, gradePercent: 4 })
    expect(r.winner).toBe('membership')
  })

  it('سیاست membership_first → گرید فقط وقتی باشگاهی نیست', () => {
    const withMembership = combineDiscounts({ ...base, policy: 'membership_first', membershipPercent: 2, gradePercent: 6 })
    expect(withMembership).toMatchObject({ discount: 20_000, winner: 'membership' })

    const withoutMembership = combineDiscounts({ ...base, policy: 'membership_first', membershipPercent: 0, gradePercent: 6 })
    expect(withoutMembership).toMatchObject({ discount: 60_000, winner: 'grade' })
  })

  it('سیاست grade_first → باشگاه فقط وقتی گرید تخفیفی ندارد', () => {
    const gradeWins = combineDiscounts({ ...base, policy: 'grade_first', membershipPercent: 5, gradePercent: 1 })
    expect(gradeWins).toMatchObject({ discount: 10_000, winner: 'grade' })

    const noGrade = combineDiscounts({ ...base, policy: 'grade_first', membershipPercent: 5, gradePercent: 0 })
    expect(noGrade).toMatchObject({ discount: 50_000, winner: 'membership' })
  })

  it('سیاست stacked → جمع با سقف درصدی', () => {
    const r = combineDiscounts({ ...base, policy: 'stacked', stackCapPercent: 10, membershipPercent: 4, gradePercent: 4 })
    // جمع ۸٪ زیر سقف ۱۰٪ → کامل اعمال می‌شود
    expect(r).toMatchObject({ discount: 80_000, winner: 'stacked' })

    const capped = combineDiscounts({ ...base, policy: 'stacked', stackCapPercent: 10, membershipPercent: 9, gradePercent: 9 })
    // جمع ۱۸٪ بالای سقف → بریده می‌شود به ۱۰٪
    expect(capped.discount).toBe(100_000)

    const zeroCap = combineDiscounts({ ...base, policy: 'stacked', stackCapPercent: 0, membershipPercent: 9, gradePercent: 9 })
    expect(zeroCap.discount).toBe(0)
  })

  it('درصد صفر گرید/عضویت مثل نبودِ آن است', () => {
    const r = combineDiscounts({ ...base, policy: 'grade_first', membershipPercent: 0, gradePercent: 0 })
    expect(r.winner).toBe('none')
  })

  it('مبلع گرد می‌شود (not float)', () => {
    const r = combineDiscounts({ ...base, eligibleSubtotal: 999_999, policy: 'max', membershipPercent: 2.5 })
    expect(Number.isInteger(r.discount)).toBe(true)
  })
})

const GRADES: GradeLike[] = [
  { id: 'bronze', name: 'برنز', min_total: 0, discount_percent: 0, sort_order: 1 },
  { id: 'silver', name: 'نقره‌ای', min_total: 10_000_000, discount_percent: 2, sort_order: 2 },
  { id: 'gold', name: 'طلایی', min_total: 30_000_000, discount_percent: 4, sort_order: 3 },
  { id: 'diamond', name: 'الماس', min_total: 70_000_000, discount_percent: 6, sort_order: 4 },
]

describe('pickGradeForTotal', () => {
  it('مجموع صفر → پایین‌ترین گرید', () => {
    expect(pickGradeForTotal(GRADES, 0)?.id).toBe('bronze')
  })

  it('مرز دقیق کف شامل می‌شود', () => {
    expect(pickGradeForTotal(GRADES, 10_000_000)?.id).toBe('silver')
    expect(pickGradeForTotal(GRADES, 9_999_999)?.id).toBe('bronze')
  })

  it('گرید غیرفعال نادیده گرفته می‌شود', () => {
    const grades = GRADES.map((g) => (g.id === 'gold' ? { ...g, is_active: false } : g))
    expect(pickGradeForTotal(grades, 35_000_000)?.id).toBe('silver')
  })

  it('لیست خالی → null', () => {
    expect(pickGradeForTotal([], 100)).toBeNull()
  })
})
