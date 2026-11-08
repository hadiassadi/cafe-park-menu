// ============================================================
// موتور ترکیب تخفیف باشگاه × گرید — خالص و بدون وابستگی به سرور
// (هم در /api/orders و هم در تست‌ها و پیش‌نمایش کلاینت استفاده می‌شود)
// ============================================================

export type DiscountPolicy = 'max' | 'membership_first' | 'grade_first' | 'stacked'

export const DISCOUNT_POLICY_VALUES: DiscountPolicy[] = [
  'max',
  'membership_first',
  'grade_first',
  'stacked',
]

export const DISCOUNT_POLICY_LABELS: Record<DiscountPolicy, string> = {
  max: 'بیشترین تخفیف',
  membership_first: 'اول باشگاه',
  grade_first: 'اول گرید',
  stacked: 'تجمیعی (با سقف)',
}

export function normalizePolicy(v: unknown): DiscountPolicy {
  return DISCOUNT_POLICY_VALUES.includes(v as DiscountPolicy)
    ? (v as DiscountPolicy)
    : 'max'
}

export type DiscountWinner = 'none' | 'membership' | 'grade' | 'stacked'

export type CombineInput = {
  policy: DiscountPolicy
  /** سقف درصد تخفیف تجمیعی (settings.grade_stack_cap) */
  stackCapPercent: number
  eligibleSubtotal: number
  /** درصد تخفیف سازمان/باشگاه — صفر یعنی عضویتی در کار نیست */
  membershipPercent: number
  /** درصد تخفیف گرید مشتری — صفر یعنی گریدی در کار نیست */
  gradePercent: number
}

export type CombineResult = {
  membershipDiscount: number
  gradeDiscount: number
  /** تخفیف نهاییِ (عضویت×گرید) قبل از کوپن */
  discount: number
  winner: DiscountWinner
}

const pctAmount = (subtotal: number, percent: number) =>
  Math.round((subtotal * percent) / 100)

/**
 * ترکیب دو تخفیف بر اساس سیاست مدیر:
 * - max: هرکدام بیشتر است برنده است (تساوی → باشگاه، مثل رفتار قبلی)
 * - membership_first / grade_first: اولویت‌دار؛ دیگری فقط وقتی صفر است
 * - stacked: جمع هر دو با سقف درصدی (grade_stack_cap)
 */
export function combineDiscounts(input: CombineInput): CombineResult {
  const policy = normalizePolicy(input.policy)
  const subtotal = Math.max(0, Math.round(input.eligibleSubtotal))
  const mPercent = Math.max(0, input.membershipPercent)
  const gPercent = Math.max(0, input.gradePercent)
  const mAmount = pctAmount(subtotal, mPercent)
  const gAmount = pctAmount(subtotal, gPercent)

  if (mAmount <= 0 && gAmount <= 0) {
    return { membershipDiscount: 0, gradeDiscount: 0, discount: 0, winner: 'none' }
  }

  if (policy === 'stacked') {
    const cap = Math.max(0, input.stackCapPercent)
    const raw = mAmount + gAmount
    const capped = Math.min(raw, pctAmount(subtotal, cap))
    return {
      membershipDiscount: mAmount,
      gradeDiscount: gAmount,
      discount: capped,
      winner: 'stacked',
    }
  }

  if (policy === 'membership_first') {
    if (mAmount > 0) {
      return { membershipDiscount: mAmount, gradeDiscount: 0, discount: mAmount, winner: 'membership' }
    }
    return { membershipDiscount: 0, gradeDiscount: gAmount, discount: gAmount, winner: 'grade' }
  }

  if (policy === 'grade_first') {
    if (gAmount > 0) {
      return { membershipDiscount: 0, gradeDiscount: gAmount, discount: gAmount, winner: 'grade' }
    }
    return { membershipDiscount: mAmount, gradeDiscount: 0, discount: mAmount, winner: 'membership' }
  }

  // max — پیش‌فرض
  if (mAmount >= gAmount) {
    return { membershipDiscount: mAmount, gradeDiscount: 0, discount: mAmount, winner: 'membership' }
  }
  return { membershipDiscount: 0, gradeDiscount: gAmount, discount: gAmount, winner: 'grade' }
}

export type GradeLike = {
  id: string
  name: string
  min_total: number
  discount_percent: number
  color?: string | null
  sort_order: number
  is_active?: boolean | null
}

/**
 * گریدِ متناظر با یک «مجموع خرید»: بالاترین گریدِ فعالِ عبورکرده از کف.
 * (قاعده‌ی فقط-ارتقا در سطح ذخیره‌سازی اعمال می‌شود؛ این تابع فقط بهترین نامزد را می‌دهد.)
 */
export function pickGradeForTotal<G extends GradeLike>(
  grades: G[],
  totalPurchase: number
): G | null {
  const total = Math.max(0, Math.round(totalPurchase))
  return (
    grades
      .filter((g) => g.is_active !== false && g.min_total <= total)
      .sort((a, b) => b.sort_order - a.sort_order || b.min_total - a.min_total)[0] ?? null
  )
}
