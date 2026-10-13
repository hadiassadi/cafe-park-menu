'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ✅ پاکسازی سفارش‌های قدیمی
export async function cleanupOldOrders(days: number = 30) {
  const db = await supabaseServer()

  // محاسبه تاریخ مرز
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffISO = cutoffDate.toISOString()

  // اول بشمار چند سفارش قدیمی هست
  const { count: countBefore, error: countError } = await db
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoffISO)
    .in('status', ['delivered', 'cancelled']) // فقط تمام‌شده‌ها یا لغو‌شده‌ها

  if (countError) {
    return { error: 'خطا در شمارش سفارش‌ها: ' + countError.message }
  }

  if (!countBefore || countBefore === 0) {
    return { success: true, deletedCount: 0, message: 'سفارش قدیمی‌ای برای حذف وجود ندارد' }
  }

  // حذف سفارش‌های قدیمی (فقط delivered و cancelled)
  const { error: deleteError } = await db
    .from('orders')
    .delete()
    .lt('created_at', cutoffISO)
    .in('status', ['delivered', 'cancelled'])

  if (deleteError) {
    return { error: 'خطا در حذف سفارش‌ها: ' + deleteError.message }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/orders')

  return {
    success: true,
    deletedCount: countBefore,
    message: `${countBefore.toLocaleString('fa-IR')} سفارش قدیمی حذف شد`,
  }
}

// ✅ شمارش سفارش‌های قدیمی (برای پیش‌نمایش)
export async function countOldOrders(days: number = 30) {
  const db = await supabaseServer()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffISO = cutoffDate.toISOString()

  const { count, error } = await db
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoffISO)
    .in('status', ['delivered', 'cancelled'])

  if (error) {
    return { error: error.message }
  }

  return { count: count ?? 0 }
}

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