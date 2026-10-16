import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

const VALID_METHODS: readonly string[] = ['cash', 'card', 'transfer']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, method } = body

    if (!orderId || !method) {
      return NextResponse.json(
        { error: 'orderId و method الزامی هستند' },
        { status: 400 }
      )
    }

    if (!VALID_METHODS.includes(method)) {
      return NextResponse.json(
        { error: 'روش پرداخت نامعتبر است' },
        { status: 400 }
      )
    }

    const db = createDb()

    const updates: Record<string, any> = {
      payment_method: method,
      payment_status: 'unpaid',
    }

    if (method === 'transfer') {
      updates.payment_status = 'pending_review'
    }

    const { error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    if (error) {
      console.error('[payment/set-method] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[payment/set-method] unexpected:', err)
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}