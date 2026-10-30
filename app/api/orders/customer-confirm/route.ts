import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'شناسه سفارش نامعتبر است' }, { status: 400 })
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش یافت نشد' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin()
      .from('orders')
      .update({ customer_confirmed: true })
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .select('id')

    if (error) return apiError(error, 'خطای پایگاه داده')
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'سفارش یافت نشد یا قابل تأیید نیست' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[customer-confirm] unexpected:', err)
    return apiError(err)
  }
}
