import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'
import { cancelErrorInfo } from '@/lib/orders/cancel-errors'

export const dynamic = 'force-dynamic'

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

    const { error } = await supabaseAdmin().rpc('cancel_order_atomic', {
      p_order_id: orderId,
      p_cancelled_by: 'customer',
      p_device_hash: deviceHash,
      p_reason_id: reasonId ?? null,
      p_reason_label: typeof reasonLabel === 'string' ? reasonLabel.slice(0, 100) : null,
      p_note: typeof note === 'string' ? note.slice(0, 500) : null,
    })

    if (error) {
      const info = cancelErrorInfo(error.message)
      if (info) return NextResponse.json({ error: info.text }, { status: info.status })
      console.error('[orders/cancel]', error)
      return NextResponse.json({ error: 'خطا در لغو سفارش' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[orders/cancel]', err)
    return apiError(err)
  }
}
