'use server'
import { assertAdmin } from '@/lib/admin/assert-admin'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addCategory(formData: FormData) {
  await assertAdmin()
  const db = await supabaseServer()

  const name = String(formData.get('name') || '').trim()
  const icon = String(formData.get('icon') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const sortOrder = Number(formData.get('sort_order') || 0)
  const couponEligible = formData.get('coupon_eligible') === 'on'

  if (!name) {
    return { error: 'نام دسته را وارد کن.' }
  }

  const { error } = await db
    .from('categories')
    .insert({
      name,
      icon: icon || null,
      description: description || null,
      is_active: true,
      sort_order: sortOrder,
      coupon_eligible: couponEligible,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateCategory(formData: FormData) {
  await assertAdmin()
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const icon = String(formData.get('icon') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const sortOrder = Number(formData.get('sort_order') || 0)
  const isActive = formData.get('is_active') === 'on'
  const couponEligible = formData.get('coupon_eligible') === 'on'

  if (!id) {
    return { error: 'شناسه دسته مشخص نیست.' }
  }

  if (!name) {
    return { error: 'نام دسته را وارد کن.' }
  }

  const { error } = await db
    .from('categories')
    .update({
      name,
      icon: icon || null,
      description: description || null,
      sort_order: sortOrder,
      is_active: isActive,
      coupon_eligible: couponEligible,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}