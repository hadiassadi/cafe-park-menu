import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

const ALLOWED_METHODS = ['cash', 'card', 'transfer', 'online'] as const
type Method = (typeof ALLOWED_METHODS)[number]

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready']
// پرداخت جزئی (پچ ۳۸): بخشی از کیف پول کسر شده؛ فقط «روشِ تسویهٔ باقی‌مانده» عوض می‌شود
const CHANGEABLE_PAYMENT_STATUSES = ['unpaid', 'pending_review', 'failed', 'partial']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId
    const method = body?.method

    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }
    if (typeof method !== 'string' || !ALLOWED_METHODS.includes(method as Method)) {
      return NextResponse.json({ error: 'روش پرداخت نامعتبر است' }, { status: 400 })
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()

    const { data: order, error: readErr } = await db
      .from('orders')
      .select('id, status, payment_status, deleted_at, payment_receipt_url, payment_note')
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .maybeSingle()

    if (readErr) {
      console.error('[payment/set-method] read:', readErr.message)
      return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
    }
    if (!order || order.deleted_at) {
      return NextResponse.json(
        { error: 'تغییر روش پرداخت ممکن نیست. اگر رسید فرستاده‌اید، منتظر تأیید مدیر بمانید.' },
        { status: 404 }
      )
    }
    if (!ACTIVE_STATUSES.includes(order.status)) {
      return NextResponse.json({ error: 'این سفارش دیگر قابل تغییر نیست' }, { status: 400 })
    }
    if (order.payment_receipt_url || order.payment_note) {
      return NextResponse.json(
        { error: 'تغییر روش پرداخت ممکن نیست. اگر رسید فرستاده‌اید، منتظر تأیید مدیر بمانید.' },
        { status: 400 }
      )
    }
    if (!CHANGEABLE_PAYMENT_STATUSES.includes(order.payment_status || 'unpaid')) {
      return NextResponse.json(
        { error: 'این سفارش تسویه شده است؛ تغییر روش پرداخت ممکن نیست' },
        { status: 400 }
      )
    }

    // در وضعیت partial، پرداخت‌های تأییدشده (بخش کیف پول) دست نمی‌خورند؛
    // فقط روشِ تسویهٔ باقی‌مانده عوض می‌شود و وضعیت partial می‌ماند.
    const updates =
      order.payment_status === 'partial'
        ? { payment_method: method }
        : { payment_method: method, payment_status: 'unpaid' }

    const { data, error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .is('deleted_at', null)
      .select('id')

    if (error) {
      console.error('[payment/set-method]', error)
      return NextResponse.json({ error: 'خطا در تغییر روش پرداخت' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'تغییر روش پرداخت ممکن نیست. اگر رسید فرستاده‌اید، منتظر تأیید مدیر بمانید.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[payment/set-method]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
