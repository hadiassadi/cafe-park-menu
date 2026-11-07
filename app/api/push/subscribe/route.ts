import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { subscription, orderId } = body

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return Response.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    if (!orderId) {
      return Response.json({ error: 'orderId required' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // ✅ فقط دستگاهِ صاحبِ سفارش حق دارد برای همان سفارش subscribe شود
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    if (!deviceToken) {
      return Response.json({ error: 'Order or device not found' }, { status: 404 })
    }
    // هش قدیمی (سفارش‌های قبل از salt) + هش جدید
    const deviceHashes = [
      hashData(deviceToken),
      crypto.createHash('sha256').update(deviceToken).digest('hex'),
    ]

    // پیدا کردن device_id_hash از روی سفارش
    const { data: order, error: orderError } = await db
      .from('orders')
      .select('device_id_hash')
      .eq('id', orderId)
      .single()

    if (orderError || !order?.device_id_hash || !deviceHashes.includes(order.device_id_hash)) {
      return Response.json(
        { error: 'Order or device not found' },
        { status: 404 }
      )
    }

    const userAgent = req.headers.get('user-agent') || null

    const { error: upsertError } = await db
      .from('push_subscriptions')
      .upsert(
        {
          device_id_hash: order.device_id_hash,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (upsertError) {
      console.error('[push/subscribe]', upsertError)
      return Response.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe] unexpected:', err)
    return Response.json({ error: 'Unexpected error' }, { status: 500 })
  }
}