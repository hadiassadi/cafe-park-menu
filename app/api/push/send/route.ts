import 'server-only'
import { sendPushToOrder } from '@/lib/push/send-push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json()
    if (!orderId || !status) {
      return Response.json(
        { error: 'orderId and status required' },
        { status: 400 }
      )
    }
    const result = await sendPushToOrder(orderId, status)
    return Response.json(result)
  } catch (err) {
    console.error('[push/send]', err)
    return Response.json({ error: 'Unexpected error' }, { status: 500 })
  }
}