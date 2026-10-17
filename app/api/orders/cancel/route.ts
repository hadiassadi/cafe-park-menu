import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, phone, reasonId, reasonLabel, note } = body

    if (!orderId || !phone) {
      return NextResponse.json({ error: 'اطلاعات ناقص است' }, { status: 400 })
    }

    const db = createAdminDb()

    // ۱. خواندن سفارش با کلید مخفی
    const { data: order, error: readError } = await db
      .from('orders')
      .select('id, status, customer_phone, created_at')
      .eq('id', orderId)
      .maybeSingle()

    if (readError || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'فقط سفارش‌های در انتظار تایید قابل لغو هستند' }, { status: 400 })
    }

    // بررسی زمان (۵ دقیقه)
    const createdTime = new Date(order.created_at).getTime()
    const now = new Date().getTime()
    if (now - createdTime > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'زمان مجاز برای لغو به پایان رسیده است' }, { status: 400 })
    }

    // ۲. آپدیت وضعیت
    const updates = {
      status: 'cancelled',
      cancelled_by: 'customer',
      cancelled_at: new Date().toISOString(),
      cancellation_reason_id: reasonId || null,
      cancellation_reason_label: reasonLabel || null,
      cancellation_note: note || null,
    }

    const { error: updateError } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    if (updateError) {
      console.error('[orders/cancel]', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطای غیرمنتظره' }, { status: 500 })
  }
}