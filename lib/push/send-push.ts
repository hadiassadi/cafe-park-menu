import 'server-only'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase/server'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  let subject = process.env.VAPID_SUBJECT || 'mailto:noreply@cafe-park.ir'

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured')
  }

  // ✅ اصلاح خودکار فرمت ایمیل (اگر mailto: نداشت، اضافه کن)
  if (subject.includes('@') && !subject.startsWith('mailto:')) {
    subject = `mailto:${subject}`
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  confirmed: {
    title: '✅ سفارش تأیید شد',
    body: 'سفارش #{{num}} تأیید شد و به‌زودی آماده‌سازی شروع می‌شه.',
  },
  preparing: {
    title: '⏳ سفارش در حال آماده‌سازیه',
    body: 'سفارش #{{num}} در حال آماده‌سازیه. کمی صبر کن!',
  },
  ready: {
    title: '🔔 سفارش آماده تحویله!',
    body: 'سفارش #{{num}} آماده‌ست. می‌تونی تحویلش بگیری.',
  },
  delivered: {
    title: '🎉 نوش جان!',
    body: 'سفارش #{{num}} تحویل شد. ممنون از سفارشت!',
  },
  cancelled: {
    title: '❌ سفارش لغو شد',
    body: 'سفارش #{{num}} لغو شد.',
  },
}

export async function sendPushToOrder(
  orderId: string,
  status: string
): Promise<{ sent: number; failed: number }> {
  console.log(`\n🔔 [Push] Start sending push for Order: ${orderId}, Status: ${status}`)

  const message = STATUS_MESSAGES[status]
  if (!message) {
    console.log(`⚠️ [Push] No message template for status: ${status}`)
    return { sent: 0, failed: 0 }
  }

  try {
    ensureVapid()
  } catch (err) {
    console.error('❌ [Push] VAPID not configured:', err)
    return { sent: 0, failed: 0 }
  }

  const db = supabaseAdmin()

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, order_number, device_id_hash')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('❌ [Push] Order fetch error:', orderError)
    return { sent: 0, failed: 0 }
  }

  if (!order.device_id_hash) {
    console.log(`⚠️ [Push] Order #${order.order_number} has NO device_id_hash!`)
    return { sent: 0, failed: 0 }
  }

  console.log(`🔍 [Push] Looking for subscriptions for device: ${order.device_id_hash}`)

  const { data: subs, error: subsError } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('device_id_hash', order.device_id_hash)
    .eq('is_active', true)

  if (subsError) {
    console.error('❌ [Push] Subs fetch error:', subsError)
    return { sent: 0, failed: 0 }
  }

  if (!subs || subs.length === 0) {
    console.log('⚠️ [Push] No active subscriptions found for this device.')
    return { sent: 0, failed: 0 }
  }

  console.log(`✅ [Push] Found ${subs.length} subscription(s). Sending...`)

  const payload = JSON.stringify({
    title: message.title,
    body: message.body.replace('{{num}}', String(order.order_number)),
    url: `/order/${order.id}`,
    tag: `order-${order.id}-${status}`,
    icon: '/icons/icon-192.png',
  })

  let sent = 0
  let failed = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        console.log(`📤 [Push] Sending to endpoint: ${sub.endpoint.substring(0, 30)}...`)
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        console.log(`✅ [Push] Sent successfully!`)
        sent++
        await db
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
      } catch (err: any) {
        console.error(`❌ [Push] Send failed:`, err)
        failed++
        const statusCode = err?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await db
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', sub.id)
        }
      }
    })
  )

  console.log(`🏁 [Push] Done. Sent: ${sent}, Failed: ${failed}\n`)
  return { sent, failed }
}