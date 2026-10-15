import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentCustomer } from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  const customer = await getCurrentCustomer()

  if (!customer) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401 }
    )
  }

  const db = createDb()

  const { data, error } = await db
    .from('orders')
    .select(
      'id, order_number, items, subtotal, original_subtotal, coupon_code, coupon_discount, status, created_at, cancelled_by, cancellation_reason_label'
    )
    .eq('customer_phone', customer.phone)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[customer orders] error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { orders: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}