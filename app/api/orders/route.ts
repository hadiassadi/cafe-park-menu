import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const db = await supabaseServer()

  try {
    const body = await request.json()

    const {
      customer_name,
      customer_phone,
      table_number,
      note,
      items,
      subtotal,
    } = body

    // اعتبارسنجی
    if (!customer_name || typeof customer_name !== 'string') {
      return NextResponse.json(
        { error: 'نام الزامی است' },
        { status: 400 }
      )
    }

    if (!customer_phone || typeof customer_phone !== 'string') {
      return NextResponse.json(
        { error: 'شماره تماس الزامی است' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'سبد خرید خالی است' },
        { status: 400 }
      )
    }

    // پیدا کردن میز
    let tableId: string | null = null
    if (table_number) {
      const { data: tableData } = await db
        .from('tables')
        .select('id')
        .eq('number', table_number)
        .maybeSingle()

      if (tableData) tableId = tableData.id
    }

    // ثبت سفارش
    const { data: order, error } = await db
      .from('orders')
      .insert({
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
        table_id: tableId,
        table_number: table_number || null,
        note: note || null,
        items,
        subtotal,
        status: 'pending',
        source: 'web',
      })
      .select()
      .single()

    if (error) {
      console.error('Order insert error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('Orders API error:', err)
    return NextResponse.json(
      { error: 'خطا در پردازش درخواست' },
      { status: 500 }
    )
  }
}