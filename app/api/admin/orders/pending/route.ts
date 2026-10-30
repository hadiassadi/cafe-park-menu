import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) throw new Error('Missing Supabase admin env')

    const db = createClient(url, key, { auth: { persistSession: false } })

    const { data, error } = await db
      .from('orders')
      .select(
        'id, order_number, customer_name, customer_phone, table_number, subtotal, items, created_at, status, payment_method, payment_status, payment_receipt_url'
      )
      .eq('status', 'pending')
            .or(
        'payment_method.in.(cash,card),payment_method.is.null,payment_status.eq.paid,and(payment_status.eq.pending_review,or(payment_receipt_url.not.is.null,payment_note.not.is.null))'
      )

      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[orders/pending] db error:', error)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }

    return NextResponse.json(
      { orders: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[orders/pending] unexpected:', err)
    return NextResponse.json({ error: 'خطای غیرمنتظره' }, { status: 500 })
  }
}
