'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addReason(formData: FormData) {
  const db = await supabaseServer()

  const label = String(formData.get('label') || '').trim()
  const target = String(formData.get('target') || 'both')
  const icon = String(formData.get('icon') || '📝').trim()
  const sortOrder = Number(formData.get('sort_order') || 0)
  const isActive = formData.get('is_active') === 'on'

  if (!label) return { error: 'متن دلیل الزامی است' }
  if (!['customer', 'admin', 'both'].includes(target)) {
    return { error: 'نوع دلیل نامعتبر است' }
  }

  const { error } = await db.from('cancellation_reasons').insert({
    label,
    target,
    icon: icon || '📝',
    sort_order: sortOrder,
    is_active: isActive,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/cancellation-reasons')
  return { success: true }
}

export async function updateReason(formData: FormData) {
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const label = String(formData.get('label') || '').trim()
  const target = String(formData.get('target') || 'both')
  const icon = String(formData.get('icon') || '📝').trim()
  const sortOrder = Number(formData.get('sort_order') || 0)
  const isActive = formData.get('is_active') === 'on'

  if (!id) return { error: 'شناسه مشخص نیست' }
  if (!label) return { error: 'متن دلیل الزامی است' }

  const { error } = await db
    .from('cancellation_reasons')
    .update({
      label,
      target,
      icon: icon || '📝',
      sort_order: sortOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/cancellation-reasons')
  return { success: true }
}

export async function deleteReason(formData: FormData) {
  const db = await supabaseServer()
  const id = String(formData.get('id') || '')

  if (!id) return { error: 'شناسه مشخص نیست' }

  const { error } = await db
    .from('cancellation_reasons')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/cancellation-reasons')
  return { success: true }
}

export async function toggleReasonActive(formData: FormData) {
  const db = await supabaseServer()
  const id = String(formData.get('id') || '')
  const isActive = formData.get('is_active') === 'true'

  if (!id) return { error: 'شناسه مشخص نیست' }

  const { error } = await db
    .from('cancellation_reasons')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/cancellation-reasons')
  return { success: true }
}