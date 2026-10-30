'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { sendPushToOrder } from '@/lib/push/send-push'
import { assertAdmin, guardAdmin } from '@/lib/admin/assert-admin'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

const ALLOWED_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
]
const ALLOWED_PAYMENT_STATUSES = ['paid', 'unpaid', 'failed']
const ALLOWED_PAYMENT_METHODS = ['cash', 'card', 'online', 'transfer']

function isValidDays(days: unknown): days is number {
  return (
    typeof days === 'number' &&
    Number.isInteger(days) &&
    days >= 7 &&
    days <= 365
  )
}

type ActionResult = { success?: boolean; error?: string }
type CleanupResult = ActionResult & { deletedCount?: number; message?: string }
type CountResult = { count?: number; error?: string }

// ─────────────────────────────────────────────
// تغییر وضعیت سفارش (با پشتیبانی از دلایل لغو)
// ─────────────────────────────────────────────
export async function updateOrderStatus(
  formData: FormData
): Promise<ActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied

  const db = createAdminDb()

  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')

  if (!id) return { error: 'شناسه سفارش مشخص نیست' }
  if (!status) return { error: 'وضعیت مشخص نیست' }
  if (!ALLOWED_STATUSES.includes(status)) {
    return { error: 'وضعیت نامعتبر است' }
  }

  const updateData: Record<string, unknown> = { status }

  // ✅ ثبت تاریخ‌های مربوط به هر وضعیت
  const now = new Date().toISOString()
  if (status === 'confirmed') updateData.confirmed_at = now
  if (status === 'preparing') updateData.preparing_at = now
  if (status === 'ready') updateData.ready_at = now
  if (status === 'delivered') updateData.delivered_at = now

  if (status === 'cancelled') {
    updateData.cancelled_at = now
    // فقط ادمین به این Action دسترسی دارد، پس مقدار ثابت است
    updateData.cancelled_by = 'admin'

    const reasonId = formData.get('cancellation_reason_id')
    const reasonLabel = formData.get('cancellation_reason_label')
    const note = formData.get('cancellation_note')

    if (reasonId) updateData.cancellation_reason_id = String(reasonId)
    if (reasonLabel) updateData.cancellation_reason_label = String(reasonLabel)
    if (note) updateData.cancellation_note = String(note)
  }

  const { error } = await db.from('orders').update(updateData).eq('id', id)

  if (error) return { error: error.message }

  // 🔔 Push notification
  if (
    ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].includes(
      status
    )
  ) {
    sendPushToOrder(id, status).catch((err) =>
      console.error('[updateOrderStatus] push failed:', err)
    )
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  revalidatePath(`/order/${id}`)
  return { success: true }
}

// ─────────────────────────────────────────────
// پاکسازی سفارش‌های قدیمی (بیشتر از N روز)
// ─────────────────────────────────────────────
export async function cleanupOldOrders(
  days: number = 30
): Promise<CleanupResult> {
  const denied = await guardAdmin()
  if (denied) return denied

  if (!isValidDays(days)) {
    return { error: 'بازه نامعتبر است (بین ۷ تا ۳۶۵ روز)' }
  }

  const db = createAdminDb()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffISO = cutoffDate.toISOString()

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
export async function countOldOrders(days: number = 30): Promise<CountResult> {
  const denied = await guardAdmin()
  if (denied) return denied

  if (!isValidDays(days)) {
    return { error: 'بازه نامعتبر است (بین ۷ تا ۳۶۵ روز)' }
  }

  const db = createAdminDb()

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
    await assertAdmin()

    const db = createAdminDb()
    const { data, error } = await db.rpc('get_cleanup_status')

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
    await assertAdmin()

    if (typeof enabled !== 'boolean') {
      return { error: 'مقدار فعال‌سازی نامعتبر است' }
    }
    if (!isValidDays(daysKept)) {
      return { error: 'بازه نگهداری باید بین ۷ تا ۳۶۵ روز باشه' }
    }

    const db = createAdminDb()
    const { data, error } = await db.rpc('update_cleanup_settings', {
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
  method?: 'cash' | 'card' | 'online' | 'transfer'
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { error: 'شناسه سفارش مشخص نیست' }
    }
    if (!ALLOWED_PAYMENT_STATUSES.includes(newStatus)) {
      return { error: 'وضعیت پرداخت نامعتبر است' }
    }
    if (method && !ALLOWED_PAYMENT_METHODS.includes(method)) {
      return { error: 'روش پرداخت نامعتبر است' }
    }

    const db = createAdminDb()

    const updates: Record<string, any> = {
      payment_status: newStatus,
    }

    let autoConfirmed = false

    if (newStatus === 'paid') {
      updates.payment_verified_at = new Date().toISOString()

      // ✅ اگر پرداخت تایید شد �� سفارش pending بود، وضعیت رو به confirmed تغییر بده
      const { data: currentOrder } = await db
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single()

      if (currentOrder && currentOrder.status === 'pending') {
        updates.status = 'confirmed'
        updates.confirmed_at = new Date().toISOString()
        autoConfirmed = true
      }
    }

    if (note) updates.payment_note = String(note).slice(0, 500)
    if (method) updates.payment_method = method

    const { error } = await db.from('orders').update(updates).eq('id', orderId)

    if (error) return { error: error.message }

    // 🔔 اگر وضعیت به صورت خودکار تغییر کرد، پوش هم ارسال بشه
    if (autoConfirmed) {
      sendPushToOrder(orderId, 'confirmed').catch((err) =>
        console.error('[updatePaymentStatus] push failed:', err)
      )
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath(`/order/${orderId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
export async function rejectReceipt(
  orderId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { error: 'شناسه سفارش مشخص نیست' }
    }

    const db = createAdminDb()

    const { data, error } = await db
      .from('orders')
      .update({
        payment_status: 'unpaid',
        payment_receipt_url: null,
        payment_note: null,
      })
      .eq('id', orderId)
      .eq('payment_method', 'transfer')
      .eq('payment_status', 'pending_review')
      .select('id')

    if (error) return { error: error.message }
    if (!data || data.length === 0) {
      return { error: 'این سفارش رسید در انتظار بررسی ندارد' }
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath(`/order/${orderId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
