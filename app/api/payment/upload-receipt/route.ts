import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { orderId, receiptUrl, receiptNote } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: 'orderId الزامی' }, { status: 400 })
    }

    if (!receiptUrl && !receiptNote) {
      return NextResponse.json(
        { error: 'رسید یا توضیحات الزامی' },
        { status: 400 }
      )
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env')

    const db = createClient(url, key, { auth: { persistSession: false } })

    const updates: Record<string, any> = {
      payment_status: 'pending_review',
    }

    if (receiptUrl) {
      updates.payment_receipt_url = receiptUrl
    }

    if (receiptNote) {
      updates.payment_note = receiptNote
    }

    const { error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    if (error) {
      console.error('[upload-receipt] update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[upload-receipt] unexpected:', err)
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}