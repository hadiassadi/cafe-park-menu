import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

const CANCEL_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const { orderId, reasonId, reasonLabel, note } = body ?? {}

    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'اطلاعات ناقص است' }, { status: 400 })
    }
    if (reasonId != null && (typeof reasonId !== 'string' || !UUID_RE.test(reasonId))) {
      return NextResponse.json({ error: 'دلیل نامعتبر است' }, { status: 400 })
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()

    const { data: order, error: readError } = await db
      .from('orders')
      .select(
        'id, status, created_at, customer_confirmed, payment_status, payment_receipt_url, payment_note'
      )
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .is('deleted_at', null)
      .maybeSingle()

    if (readError || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    if (order.status !== 'pending' || order.customer_confirmed) {
      return NextResponse.json({ error: 'این سفارش دیگر قابل لغو نیست' }, { status: 400 })
    }

    const receiptSent = !!(order.payment_receipt_url || order.payment_note)
    if (order.payment_status === 'paid' || receiptSent) {
      return NextResponse.json(
        { error: 'سفارش پرداخت‌شده یا دارای رسید را فقط کافه می‌تواند لغو کند' },
        { status: 400 }
      )
    }

    if (Date.now() - new Date(order.created_at).getTime() > CANCEL_WINDOW_MS) {
      return NextResponse.json(
        { error: 'زمان مجاز برای لغو به پایان رسیده است' },
        { status: 400 }
      )
    }

    // لغو شرطی؛ کوپن را تریگر دیتابیس خودکار برمی‌گرداند
    const { data: updated, error: updateError } = await db
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_by: 'customer',
        cancelled_at: new Date().toISOString(),
        cancellation_reason_id: reasonId ?? null,
        cancellation_reason_label:
          typeof reasonLabel === 'string' ? reasonLabel.slice(0, 100) : null,
        cancellation_note: typeof note === 'string' ? note.slice(0, 500) : null,
      })
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .eq('status', 'pending')
      .eq('customer_confirmed', false)
      .neq('payment_status', 'paid')
      .is('payment_receipt_url', null)
      .is('payment_note', null)
      .is('deleted_at', null)
      .select('id')

    if (updateError) {
      console.error('[orders/cancel]', updateError)
      return NextResponse.json({ error: 'خطا در لغو سفارش' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'وضعیت سفارش تغییر کرده است' }, { status: 409 })
    }

    const { error: logError } = await db
      .from('redemption_logs')
      .delete()
      .eq('order_id', orderId)
    if (logError) console.error('[orders/cancel] redemption_logs', logError)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[orders/cancel]', err)
    return apiError(err)
  }
}
