'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
// اگه این import قبلاً نیست، اضافه کن:
// import { supabaseServer } from '@/lib/supabase/server'
// ─────────────────────────────────────────────
// تغییر وضعیت سفارش (با پشتیبانی از دلایل لغو)
// ─────────────────────────────────────────────
export async function updateOrderStatus(formData: FormData) {
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')

  if (!id) return { error: 'شناسه سفارش مشخص نیست' }
  if (!status) return { error: 'وضعیت مشخص نیست' }

  const updateData: Record<string, unknown> = { status }

  // ✅ ثبت تاریخ‌های مربوط به هر وضعیت
  const now = new Date().toISOString()
  if (status === 'confirmed') updateData.confirmed_at = now
  if (status === 'preparing') updateData.preparing_at = now
  if (status === 'ready') updateData.ready_at = now
  if (status === 'delivered') updateData.delivered_at = now

  if (status === 'cancelled') {
    updateData.cancelled_at = now
    updateData.cancelled_by =
      String(formData.get('cancelled_by') || 'admin') || 'admin'

    const reasonId = formData.get('cancellation_reason_id')
    const reasonLabel = formData.get('cancellation_reason_label')
    const note = formData.get('cancellation_note')

    if (reasonId) updateData.cancellation_reason_id = String(reasonId)
    if (reasonLabel) updateData.cancellation_reason_label = String(reasonLabel)
    if (note) updateData.cancellation_note = String(note)
  }

  const { error } = await db
    .from('orders')
    .update(updateData)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  return { success: true }
}

// ─────────────────────────────────────────────
// پاکسازی سفارش‌های قدیمی (بیشتر از N روز)
// ─────────────────────────────────────────────
export async function cleanupOldOrders(days: number = 30) {
  const db = await supabaseServer()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffISO = cutoffDate.toISOString()

  // شمارش قبل از حذف
  const { count: countBefore, error: countError } = await db
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoffISO)
    .in('status', ['delivered', 'cancelled'])

  if (countError) {
    return { error: 'خطا در شمارش سفارش‌ها: ' + countError.message }
  }

  if (!countBefore || countBefore === 0) {
    return {
      success: true,
      deletedCount: 0,
      message: 'سفارش قدیمی‌ای برای حذف وجود ندارد',
    }
  }

  // حذف
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

// ─────────────────────────────────────────────
// شمارش سفارش‌های قدیمی (برای پیش‌نمایش)
// ─────────────────────────────────────────────
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
// ═══════════════════════════════════════════════════════════
// Server Actions برای پاکسازی خودکار (Auto Cleanup)
// ═══════════════════════════════════════════════════════════

export type CleanupStatus = {
  enabled: boolean
  days_kept: number
  job_active: boolean
  last_run: {
    status: string
    return_message: string
    start_time: string
    end_time: string
  } | null
}

export async function getCleanupStatus(): Promise<{
  data?: CleanupStatus
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data, error } = await supabase.rpc('get_cleanup_status')

    if (error) {
      console.error('[getCleanupStatus]', error)
      return { error: error.message }
    }

    return { data: data as CleanupStatus }
  } catch (err: any) {
    console.error('[getCleanupStatus] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function updateCleanupSettings(
  enabled: boolean,
  daysKept: number
): Promise<{ data?: CleanupStatus; error?: string }> {
  try {
    if (daysKept < 7 || daysKept > 365) {
      return { error: 'بازه نگهداری باید بین ۷ تا ۳۶۵ روز باشه' }
    }

    const supabase = await supabaseServer()
    const { data, error } = await supabase.rpc('update_cleanup_settings', {
      p_enabled: enabled,
      p_days: daysKept,
    })

    if (error) {
      console.error('[updateCleanupSettings]', error)
      return { error: error.message }
    }

    return { data: data as CleanupStatus }
  } catch (err: any) {
    console.error('[updateCleanupSettings] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
export async function updatePaymentStatus(
  orderId: string,
  newStatus: 'paid' | 'unpaid' | 'failed',
  note?: string,
  method?: 'cash' | 'card' | 'online' | 'transfer' // ✅ اضافه شد
): Promise<{ success?: boolean; error?: string }> {
  try {
    const db = await supabaseServer()

    const updates: Record<string, any> = {
      payment_status: newStatus,
    }

    if (newStatus === 'paid') {
      updates.payment_verified_at = new Date().toISOString()
    }

    if (note) {
      updates.payment_note = note
    }

    if (method) {
      updates.payment_method = method
    }

    const { error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    if (error) return { error: error.message }

    revalidatePath('/admin/orders')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}