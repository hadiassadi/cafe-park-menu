import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value

    if (!deviceToken) {
      return NextResponse.json({ orders: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const deviceIdHash = crypto.createHash('sha256').update(deviceToken).digest('hex')
    const db = createAdminDb()

    const { data, error } = await db
      .from('orders')
      .select(
        'id, order_number, items, subtotal, original_subtotal, coupon_code, coupon_discount, status, created_at, cancelled_by, cancellation_reason_label, customer_name, customer_phone'
      )
      .eq('device_id_hash', deviceIdHash) // ✅ فقط سفارش‌های همین دستگاه
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { orders: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}