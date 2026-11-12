'use server'
import { assertAdmin } from '@/lib/admin/assert-admin'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

export async function addTable(formData: FormData) {
  await assertAdmin()
  const db = await supabaseServer()

  const number = Number(formData.get('number') || 0)
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const capacity = Number(formData.get('capacity') || 2)
  const location = String(formData.get('location') || 'indoor')
  const sortOrder = Number(formData.get('sort_order') || 0)
  const reservationFee = Number(formData.get('reservation_fee') || 0)
  const isActive = formData.get('is_active') === 'on'

  if (number <= 0) return { error: 'شماره میز الزامی است.' }

  const { error } = await db.from('tables').insert({
    number,
    name: name || null,
    description: description || null,
    capacity,
    location,
    sort_order: sortOrder,
    reservation_fee: reservationFee,
    is_active: isActive,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/tables')
  return { success: true }
}

export async function updateTable(formData: FormData) {
  await assertAdmin()
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const number = Number(formData.get('number') || 0)
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const capacity = Number(formData.get('capacity') || 2)
  const location = String(formData.get('location') || 'indoor')
  const sortOrder = Number(formData.get('sort_order') || 0)
  const reservationFee = Number(formData.get('reservation_fee') || 0)
  const isActive = formData.get('is_active') === 'on'

  if (!id) return { error: 'شناسه میز مشخص نیست.' }
  if (number <= 0) return { error: 'شماره میز الزامی است.' }

  const { error } = await db
    .from('tables')
    .update({
      number,
      name: name || null,
      description: description || null,
      capacity,
      location,
      sort_order: sortOrder,
      reservation_fee: reservationFee,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/tables')
  return { success: true }
}

export async function deleteTable(formData: FormData) {
  await assertAdmin()
  const db = await supabaseServer()
  const id = String(formData.get('id') || '')

  if (!id) return { error: 'شناسه میز مشخص نیست.' }

  const { error } = await db.from('tables').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/tables')
  return { success: true }
}

// 🎯 پچ ۵۰-ا: چرخش توکن QR — لینک قبلی باطل و QR جدید صادر می‌شود
function newQrToken() {
  return randomUUID().replace(/-/g, '')
}

export async function rotateTableToken(formData: FormData) {
  await assertAdmin()
  const db = await supabaseServer()
  const id = String(formData.get('id') || '')

  if (!id) return { error: 'شناسه میز مشخص نیست.' }

  const { error } = await db
    .from('tables')
    .update({ qr_token: newQrToken(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/tables')
  return { success: true }
}

export async function rotateAllTableTokens() {
  await assertAdmin()
  const db = await supabaseServer()

  const { data: rows, error: selErr } = await db.from('tables').select('id')
  if (selErr) return { error: selErr.message }

  const list = rows ?? []
  for (const row of list) {
    const { error } = await db
      .from('tables')
      .update({ qr_token: newQrToken(), updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/tables')
  return { success: true, count: list.length }
}