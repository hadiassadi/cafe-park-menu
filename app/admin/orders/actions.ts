'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { sendPushToOrder } from '@/lib/push/send-push'
import { assertAdmin, assertAdminId, guardAdmin } from '@/lib/admin/assert-admin'
import { paymentErrorMessage } from '@/lib/payment/methods'

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

// ─────────────────────────────────────────────
// ثبت پرداخت توسط مدیر (از طریق دفتر پرداخت)
// ─────────────────────────────────────────────
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
    if (newStatus !== 'paid') {
      return { error: 'فعلاً فقط ثبت پرداخت پشتیبانی می‌شود' }
    }
    if (method && !ALLOWED_PAYMENT_METHODS.includes(method)) {
      return { error: 'روش پرداخت نامعتبر است' }
    }

    const db = createAdminDb()

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, subtotal, status, payment_method, deleted_at')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) return { error: 'سفارش پیدا نشد' }
    if (order.deleted_at || order.status === 'cancelled') {
      return { error: 'این سفارش لغو یا حذف شده است' }
    }

    // باقی‌مانده = مبلغ سفارش − پرداخت‌های تأییدشده
    const { data: confirmedRows, error: sumErr } = await db
      .from('order_payments')
      .select('amount')
      .eq('order_id', orderId)
      .eq('status', 'confirmed')
    if (sumErr) return { error: 'خطا در خواندن پرداخت‌ها' }

    const paid = (confirmedRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const remaining = Number(order.subtotal) - paid

    // اگر قبلاً تسویه شده، دوباره ردیف نساز
    if (remaining <= 0) {
      revalidatePath('/admin/orders')
      revalidatePath(`/order/${orderId}`)
      return { success: true }
    }

    const payMethod = method ?? (order.payment_method as string | null) ?? 'cash'

    const { error: addErr } = await db.rpc('add_order_payment', {
      p_order_id: orderId,
      p_method: payMethod,
      p_amount: remaining,
      p_created_by: 'admin',
      p_status: 'confirmed',
    })
    if (addErr) {
      console.error('[updatePaymentStatus] add_order_payment:', addErr)
      return { error: paymentErrorMessage(addErr.message) }
    }

    // فیلدهای جانبی سفارش (روش، زمان تأیید، یادداشت)
    const updates: Record<string, any> = {
      payment_method: payMethod,
      payment_verified_at: new Date().toISOString(),
    }
    if (note) updates.payment_note = String(note).slice(0, 500)

    // اگر سفارش جدید بود، با تأیید پرداخت تأیید شود
    let autoConfirmed = false
    if (order.status === 'pending') {
      updates.status = 'confirmed'
      updates.confirmed_at = new Date().toISOString()
      autoConfirmed = true
    }

    const { error: updErr } = await db.from('orders').update(updates).eq('id', orderId)
    if (updErr) {
      // پرداخت در دفتر ثبت شده؛ فقط فیلدهای جانبی ناموفق بوده‌اند
      console.error('[updatePaymentStatus] side fields:', updErr)
    }

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
// ─────────────────────────────────────────────
// رسیدهای در انتظار روی دفتر پرداخت (بدهی)
// ─────────────────────────────────────────────
export type LedgerReceipt = {
  id: string
  amount: number
  method: string
  receipt_url: string | null
  receipt_note: string | null
  created_at: string
}

const LEDGER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getPendingLedgerReceipts(
  orderId: string
): Promise<{ data?: LedgerReceipt[]; error?: string }> {
  try {
    await assertAdmin()

    if (!orderId || !LEDGER_UUID_RE.test(orderId)) {
      return { error: 'شناسه سفارش نامعتبر است' }
    }

    const db = createAdminDb()
    const { data, error } = await db
      .from('order_payments')
      .select('id, amount, method, receipt_url, receipt_note, created_at')
      .eq('order_id', orderId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[getPendingLedgerReceipts]', error)
      return { error: 'خطا در خواندن رسیدها' }
    }

    return {
      data: (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })),
    }
  } catch (err: any) {
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function reviewLedgerReceipt(
  paymentId: string,
  decision: 'confirmed' | 'rejected',
  reason?: string
): Promise<{ success?: boolean; error?: string; paymentStatus?: string }> {
  try {
        const adminId = await assertAdminId()

    if (!paymentId || !LEDGER_UUID_RE.test(paymentId)) {
      return { error: 'شناسه پرداخت نامعتبر است' }
    }
    if (decision !== 'confirmed' && decision !== 'rejected') {
      return { error: 'تصمیم نامعتبر است' }
    }

    const db = createAdminDb()

    const { data: row, error: rowErr } = await db
      .from('order_payments')
      .select('id, order_id, status')
      .eq('id', paymentId)
      .maybeSingle()

    if (rowErr || !row) return { error: 'رسید پیدا نشد' }
    if (row.status !== 'pending_review') {
      return { error: 'این رسید قبلاً بررسی شده است' }
    }

    const cleanReason =
      decision === 'rejected' && reason?.trim()
        ? reason.trim().slice(0, 300)
        : null

    const { data: newStatus, error: rpcErr } = await db.rpc(
      'set_order_payment_status',
      {
        p_payment_id: paymentId,
        p_new_status: decision,
        p_verified_by: adminId,
        p_ref_id: null,
        p_reason: cleanReason,
      }
    )

    if (rpcErr) {
      console.error('[reviewLedgerReceipt] rpc:', rpcErr)
      if (rpcErr.message?.includes('payment_already_final')) {
        return { error: 'این رسید قبلاً بررسی شده است' }
      }
      return { error: 'خطا در ثبت نتیجهٔ بررسی' }
    }

    // رسید واریزی تأییدشده: روش پرداخت سفارش هم «واریز» ثبت شود
    if (decision === 'confirmed' && newStatus === 'paid') {
      const { error: updErr } = await db
        .from('orders')
        .update({ payment_method: 'transfer' })
        .eq('id', row.order_id)
      if (updErr) console.error('[reviewLedgerReceipt] side fields:', updErr)
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath(`/order/${row.order_id}`)
    return { success: true, paymentStatus: String(newStatus) }
  } catch (err: any) {
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
