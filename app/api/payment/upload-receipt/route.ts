import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { orderId, receiptUrl } = await req.json()

    if (!orderId || !receiptUrl) {
      return NextResponse.json({ error: 'اطلاعات ناقص' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env')

    const db = createClient(url, key, { auth: { persistSession: false } })

    const { error } = await db
      .from('orders')
      .update({
        payment_receipt_url: receiptUrl,
        payment_status: 'pending_review',
      })
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