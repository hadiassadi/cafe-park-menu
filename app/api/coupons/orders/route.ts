import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim().toUpperCase()
  const filter = searchParams.get('filter') || 'all'

  if (!code) {
    return NextResponse.json(
      { error: 'کد کوپن الزامی است' },
      { status: 400 }
    )
  }

  try {
    const db = await supabaseServer()

    let query = db
      .from('orders')
            .select(
        'id, order_number, customer_name, customer_phone, table_number, note, items, subtotal, original_subtotal, coupon_discount, status, created_at'
      )
      .eq('coupon_code', code)
      .order('created_at', { ascending: false })

    // فیلتر زمانی
    if (filter === 'today') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    } else if (filter === 'week') {
      const start = new Date()
      const day = start.getDay()
      const diff = day === 6 ? 0 : day + 1
      start.setDate(start.getDate() - diff)
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    } else if (filter === 'month') {
      const start = new Date()
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('[coupon orders] error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ orders: data ?? [] })
  } catch (err) {
    console.error('[coupon orders] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}