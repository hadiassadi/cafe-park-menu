'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { guardAdmin } from '@/lib/admin/assert-admin'

type ActionResult = { success?: boolean; error?: string }

// ✅ افزودن کوپن جدید
export async function addCoupon(formData: FormData): Promise<ActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied

  const db = await supabaseServer()

  const code = String(formData.get('code') || '').trim().toUpperCase()
  const description = String(formData.get('description') || '').trim()
  const discountType = String(formData.get('discount_type') || 'percent')
  const discountValue = Number(formData.get('discount_value') || 0)
  const minOrderAmount = Number(formData.get('min_order_amount') || 0)
  const maxDiscountRaw = formData.get('max_discount')
  const maxDiscount = maxDiscountRaw ? Number(maxDiscountRaw) : null
  const maxUsesRaw = formData.get('max_uses')
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null
  const validFrom = String(formData.get('valid_from') || '').trim() || null
  const validUntil = String(formData.get('valid_until') || '').trim() || null
  const isActive = formData.get('is_active') === 'on'

  if (!code) return { error: 'کد تخفیف الزامی است' }
  if (!['percent', 'fixed'].includes(discountType)) {
    return { error: 'نوع تخفیف نامعتبر است' }
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { error: 'مقدار تخفیف باید مثبت باشد' }
  }
  if (discountType === 'percent' && discountValue > 100) {
    return { error: 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد' }
  }
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
    return { error: 'حداقل مبلغ سفارش نامعتبر است' }
  }

  const { error } = await db.from('coupons').insert({
    code,
    description: description || null,
    discount_type: discountType,
    discount_value: discountValue,
    min_order_amount: minOrderAmount,
    max_discount: maxDiscount,
    max_uses: maxUses,
    valid_from: validFrom || new Date().toISOString(),
    valid_until: validUntil,
    is_active: isActive,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'این کد تخفیف قبلاً وجود دارد' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/coupons')
  return { success: true }
}

// ✅ ویرایش کوپن
export async function updateCoupon(formData: FormData): Promise<ActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied

  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const code = String(formData.get('code') || '').trim().toUpperCase()
  const description = String(formData.get('description') || '').trim()
  const discountType = String(formData.get('discount_type') || 'percent')
  const discountValue = Number(formData.get('discount_value') || 0)
  const minOrderAmount = Number(formData.get('min_order_amount') || 0)
  const maxDiscountRaw = formData.get('max_discount')
  const maxDiscount = maxDiscountRaw ? Number(maxDiscountRaw) : null
  const maxUsesRaw = formData.get('max_uses')
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null
  const validFrom = String(formData.get('valid_from') || '').trim() || null
  const validUntil = String(formData.get('valid_until') || '').trim() || null
  const isActive = formData.get('is_active') === 'on'

  if (!id) return { error: 'شناسه کوپن مشخص نیست' }
  if (!code) return { error: 'کد تخفیف الزامی است' }
  if (!['percent', 'fixed'].includes(discountType)) {
    return { error: 'نوع تخفیف نامعتبر است' }
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { error: 'مقدار تخفیف باید مثبت باشد' }
  }
  if (discountType === 'percent' && discountValue > 100) {
    return { error: 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد' }
  }
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
    return { error: 'حداقل مبلغ سفارش نامعتبر است' }
  }

  const { error } = await db
    .from('coupons')
    .update({
      code,
      description: description || null,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount,
      max_discount: maxDiscount,
      max_uses: maxUses,
      valid_from: validFrom || new Date().toISOString(),
      valid_until: validUntil,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'این کد تخفیف قبلاً وجود دارد' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/coupons')
  return { success: true }
}

// ✅ حذف کوپن
export async function deleteCoupon(formData: FormData): Promise<ActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied

  const db = await supabaseServer()
  const id = String(formData.get('id') || '')

  if (!id) return { error: 'شناسه کوپن مشخص نیست' }

  const { error } = await db.from('coupons').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/coupons')
  return { success: true }
}

// ✅ تغییر وضعیت فعال/غیرفعال
export async function toggleCouponActive(
  formData: FormData
): Promise<ActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied

  const db = await supabaseServer()
  const id = String(formData.get('id') || '')
  const isActive = formData.get('is_active') === 'true'

  if (!id) return { error: 'شناسه کوپن مشخص نیست' }

  const { error } = await db
    .from('coupons')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/coupons')
  return { success: true }
}
