'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { assertAdmin, assertAdminId } from '@/lib/admin/assert-admin'
import { normalizePolicy } from '@/lib/club/discount-policy'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type AdminGrade = {
  id: string
  name: string
  min_total: number
  discount_percent: number
  color: string | null
  sort_order: number
  is_active: boolean
}

export type GradePolicyForm = {
  discount_policy: string
  grade_stack_cap: number
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function toNum(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function listGrades(): Promise<{
  grades?: AdminGrade[]
  policy?: GradePolicyForm
  error?: string
}> {
  try {
    await assertAdmin()
    const db = createAdminDb()

    const [{ data: grades, error: gErr }, { data: settings, error: sErr }] =
      await Promise.all([
        db
          .from('customer_grades')
          .select('id, name, min_total, discount_percent, color, sort_order, is_active')
          .order('sort_order', { ascending: true }),
        db
          .from('settings')
          .select('discount_policy, grade_stack_cap')
          .eq('id', 1)
          .maybeSingle(),
      ])

    if (gErr) {
      console.error('[grades] list:', gErr)
      return { error: 'خطا در خواندن گریدها' }
    }
    if (sErr) {
      console.error('[grades] settings:', sErr)
      return { error: 'خطا در خواندن سیاست تخفیف' }
    }

    return {
      grades: (grades ?? []).map((g: any) => ({
        id: String(g.id),
        name: String(g.name ?? ''),
        min_total: Number(g.min_total ?? 0),
        discount_percent: Number(g.discount_percent ?? 0),
        color: (g.color as string) ?? null,
        sort_order: Number(g.sort_order ?? 0),
        is_active: g.is_active !== false,
      })),
      policy: {
        discount_policy: normalizePolicy(settings?.discount_policy),
        grade_stack_cap: Number(settings?.grade_stack_cap ?? 10),
      },
    }
  } catch (err: any) {
    console.error('[grades] list unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export type GradeInput = {
  id?: string | null
  name: string
  min_total: number
  discount_percent: number
  color: string
  sort_order: number
  is_active: boolean
}

export async function saveGrade(
  input: GradeInput
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdminId()
    if (!input || typeof input !== 'object') return { error: 'داده‌ی نامعتبر' }

    const name = String(input.name ?? '').trim()
    if (!name) return { error: 'نام گرید الزامی است' }
    if (name.length > 40) return { error: 'نام گرید حداکثر ۴۰ نویسه است' }

    const minTotal = toNum(input.min_total)
    if (minTotal === null || minTotal < 0 || minTotal > 1_000_000_000_000) {
      return { error: 'کف مجموع خرید نامعتبر است' }
    }

    const percent = toNum(input.discount_percent)
    if (percent === null || percent < 0 || percent > 100) {
      return { error: 'درصد تخفیف باید بین ۰ تا ۱۰۰ باشد' }
    }

    const color = String(input.color ?? '').trim()
    if (!HEX_RE.test(color)) return { error: 'رنگ باید یک کد HEX معتبر باشد (مثل #d4af37)' }

    const sortOrder = toNum(input.sort_order)
    if (sortOrder === null || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
      return { error: 'ترتیب نمایش باید عددی بین ۰ تا ۹۹۹ باشد' }
    }

    const db = createAdminDb()
    const row = {
      name,
      min_total: Math.round(minTotal),
      discount_percent: percent,
      color: color.toLowerCase(),
      sort_order: sortOrder,
      is_active: input.is_active === true,
    }

    if (input.id) {
      const { error } = await db
        .from('customer_grades')
        .update(row)
        .eq('id', String(input.id))
      if (error) {
        console.error('[grades] update:', error)
        return { error: 'خطا در ذخیره‌ی گرید' }
      }
    } else {
      const { error } = await db.from('customer_grades').insert(row)
      if (error) {
        console.error('[grades] insert:', error)
        return { error: 'خطا در ساخت گرید' }
      }
    }

    revalidatePath('/admin/settings/grades')
    return { success: true }
  } catch (err: any) {
    console.error('[grades] save unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function deleteGrade(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdminId()
    if (!id) return { error: 'شناسه گرید نامعتبر است' }

    const db = createAdminDb()

    // اگر مشتری‌هایی این گرید را دارند، حذف نکن — غیرفعال کن
    const { count, error: countErr } = await db
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('grade_id', id)

    if (countErr) {
      console.error('[grades] delete count:', countErr)
      return { error: 'خطا در بررسی استفاده‌کنندگان گرید' }
    }
    if ((count ?? 0) > 0) {
      return {
        error: `${(count ?? 0).toLocaleString('fa-IR')} مشتری این گرید را دارند؛ به‌جای حذف، گرید را «غیرفعال» کن.`,
      }
    }

    const { error } = await db.from('customer_grades').delete().eq('id', id)
    if (error) {
      console.error('[grades] delete:', error)
      return { error: 'خطا در حذف گرید' }
    }

    revalidatePath('/admin/settings/grades')
    return { success: true }
  } catch (err: any) {
    console.error('[grades] delete unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function saveGradePolicy(
  input: GradePolicyForm
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdminId()

    const policy = normalizePolicy(input?.discount_policy)
    const cap = toNum(input?.grade_stack_cap)
    if (cap === null || cap < 0 || cap > 100) {
      return { error: 'سقف تخفیف تجمیعی باید عددی بین ۰ تا ۱۰۰ باشد' }
    }

    const db = createAdminDb()
    const { error } = await db
      .from('settings')
      .update({ discount_policy: policy, grade_stack_cap: cap })
      .eq('id', 1)

    if (error) {
      console.error('[grades] policy save:', error)
      return { error: 'خطا در ذخیره‌ی سیاست تخفیف' }
    }

    revalidatePath('/admin/settings/grades')
    return { success: true }
  } catch (err: any) {
    console.error('[grades] policy unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
