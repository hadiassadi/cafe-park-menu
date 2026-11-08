import 'server-only'
import { supabaseAdmin } from '../supabase/server' // ایمپورت نسبی: توسط vitest هم لود می‌شود
import {
  normalizePolicy,
  pickGradeForTotal,
  type DiscountPolicy,
  type GradeLike,
} from '../club/discount-policy'

// ============================================================
// گرید مشتری — پیکربندی و جست‌وجو (سمت سرور)
// ============================================================

export type GradeConfig = {
  policy: DiscountPolicy
  stackCapPercent: number
}

/** سیاست تخفیف و سقف تجمیعی از تنظیمات — با پیش‌فرض محتاطانه در خطا */
export async function getGradeConfig(): Promise<GradeConfig> {
  const { data } = await supabaseAdmin()
    .from('settings')
    .select('discount_policy, grade_stack_cap')
    .eq('id', 1)
    .single()

  return {
    policy: normalizePolicy(data?.discount_policy),
    stackCapPercent: Number(data?.grade_stack_cap ?? 10),
  }
}

export type CustomerGrade = GradeLike & {
  discount_percent: number
}

/** همه‌ی گریدهای فعال (برای پنل ادمین و محاسبه) */
export async function listActiveGrades(): Promise<CustomerGrade[]> {
  const { data, error } = await supabaseAdmin()
    .from('customer_grades')
    .select('id, name, min_total, discount_percent, color, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[grades] list failed:', error.message)
    return []
  }
  return (data ?? []).map((g: any) => ({
    id: String(g.id),
    name: String(g.name),
    min_total: Number(g.min_total ?? 0),
    discount_percent: Number(g.discount_percent ?? 0),
    color: (g.color as string) ?? null,
    sort_order: Number(g.sort_order ?? 0),
    is_active: true,
  }))
}

export type ResolvedGrade = {
  id: string
  name: string
  discountPercent: number
  color: string | null
}

/**
 * گریدِ فعالِ مشتریِ احرازشده بر اساس شماره — برای اعمال تخفیف در ثبت سفارش.
 * گریدِ ذخیره‌شده (grade_id) مبناست؛ اگر غیرفعال/حذف شده باشد تخفیفی نمی‌گیرد.
 */
export async function getVerifiedCustomerGrade(
  phone: string | null | undefined
): Promise<ResolvedGrade | null> {
  if (!phone) return null

  const { data, error } = await supabaseAdmin()
    .from('customers')
    .select(
      'id, verification_status, grade_id, customer_grades(name, discount_percent, color, is_active)'
    )
    .eq('phone', phone)
    .eq('verification_status', 'verified')
    .maybeSingle()

  if (error) {
    console.error('[grades] customer lookup failed:', error.message)
    return null
  }
  if (!data?.grade_id) return null

  const g = data.customer_grades as any
  if (!g || g.is_active === false) return null

  return {
    id: String(data.grade_id),
    name: String(g.name ?? ''),
    discountPercent: Number(g.discount_percent ?? 0),
    color: (g.color as string) ?? null,
  }
}

/** بهترین گریدِ فعال برای یک مجموع خرید — برای پیش‌نمایش و backfill */
export function bestGradeForTotal(
  grades: CustomerGrade[],
  totalPurchase: number
): CustomerGrade | null {
  return pickGradeForTotal(grades, totalPurchase)
}
