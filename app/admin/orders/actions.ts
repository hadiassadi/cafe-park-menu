'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateOrderStatus(formData: FormData) {
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')

  if (!id) return { error: 'شناسه سفارش مشخص نیست.' }
  if (!status) return { error: 'وضعیت مشخص نیست.' }

  const allowed = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'delivered',
    'cancelled',
  ]
  if (!allowed.includes(status)) {
    return { error: 'وضعیت نامعتبر است.' }
  }

  // ستون‌های زمانی
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'preparing') updates.preparing_at = new Date().toISOString()
  if (status === 'ready') updates.ready_at = new Date().toISOString()
  if (status === 'delivered') updates.delivered_at = new Date().toISOString()
  if (status === 'cancelled') {
    updates.cancelled_at = new Date().toISOString()
    updates.cancelled_by = 'admin'
  }

  const { error } = await db.from('orders').update(updates).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/orders')
  revalidatePath(`/order/${id}`)
  return { success: true }
}