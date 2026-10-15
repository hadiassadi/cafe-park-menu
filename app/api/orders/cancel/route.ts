import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

const CANCEL_WINDOW_MINUTES = 5

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, phone, reasonId, reasonLabel, note } = body

    if (!orderId || !phone) {
      return NextResponse.json(
        { error: 'اطلاعات ناقص است' },
        { status: 400 }
      )
    }

    const db = await supabaseServer()

    const { data: order, error: fetchError } = await db
      .from('orders')
      .select('id, status, created_at, customer_phone')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError || !order) {
      return NextResponse.json(
        { error: 'سفارش پیدا نشد' },
        { status: 404 }
      )
    }

    const normalize = (s: string) =>
      s
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[^\d]/g, '')

    if (normalize(order.customer_phone) !== normalize(phone)) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'این سفارش دیگه قابل لغو نیست' },
        { status: 400 }
      )
    }

    const createdAt = new Date(order.created_at).getTime()
    const now = Date.now()
    const diffMinutes = (now - createdAt) / (1000 * 60)

    if (diffMinutes > CANCEL_WINDOW_MINUTES) {
      return NextResponse.json(
        {
          error: `زمان لغو به پایان رسیده (بیش از ${CANCEL_WINDOW_MINUTES} دقیقه)`,
        },
        { status: 400 }
      )
    }

    // ✅ انجام لغو با دلیل (اختیاری)
    const updateData: Record<string, unknown> = {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'customer',
    }

    if (reasonId) updateData.cancellation_reason_id = reasonId
    if (reasonLabel) updateData.cancellation_reason_label = reasonLabel
    if (note) updateData.cancellation_note = note

    const { error: updateError } = await db
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cancel order] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}