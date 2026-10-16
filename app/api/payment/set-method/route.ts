import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_METHODS = ['cash', 'card', 'transfer'] as const

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

    const db = await supabaseServer()

    const updates: Record<string, any> = {
      payment_method: method,
      payment_status: 'unpaid',
    }

    // برای واریز بانکی، منتظر بررسی ادمین
    if (method === 'transfer') {
      updates.payment_status = 'pending_review'
    }

    const { error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}