'use server'

import { supabaseServer } from '@/lib/supabase/server'

export async function addCategory(formData: FormData) {
  const db = await supabaseServer()

  const name = String(formData.get('name') || '').trim()
  const icon = String(formData.get('icon') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const sortOrder = Number(formData.get('sort_order') || 0)

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
    })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updateCategory(formData: FormData) {
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const icon = String(formData.get('icon') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const sortOrder = Number(formData.get('sort_order') || 0)
  const isActive = formData.get('is_active') === 'on'

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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}