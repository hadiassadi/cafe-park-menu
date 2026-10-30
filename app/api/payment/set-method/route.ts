import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

const ALLOWED_METHODS = ['cash', 'card', 'transfer', 'online'] as const
type Method = (typeof ALLOWED_METHODS)[number]

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready']

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

        const updates = {
      payment_method: method,
      payment_status: 'unpaid',
    }


    const { data, error } = await supabaseAdmin()
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .in('payment_status', ['unpaid', 'pending_review', 'failed'])
      .is('payment_receipt_url', null)
      .is('payment_note', null)
      .in('status', ACTIVE_STATUSES)
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
