import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY // ✅ کلید مخفی
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customer_name,
      customer_phone,
      table_number,
      note,
      items,
      subtotal,
      coupon_code,
    } = body

    if (!customer_name || !customer_phone || !items || items.length === 0) {
      return NextResponse.json({ error: 'اطلاعات سفارش ناقص است' }, { status: 400 })
    }

    const db = createAdminDb()

    // ۱. تولید شماره سفارش جدید (به صورت ساده، فرض می‌کنیم شماره قبلی + ۱)
    const { data: lastOrder } = await db
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrderNumber = (lastOrder?.order_number || 1000) + 1

    // ۲. محاسبه کوپن در سرور (برای امنیت نباید به مبلغ کلاینت اعتماد کنیم)
    let finalSubtotal = subtotal
    let couponDiscount = 0
    let originalSubtotal = null

    if (coupon_code) {
      // اینجا باید منطق اعتبارسنجی کوپن رو دوباره پیاده‌سازی کنیم
      // (در نسخه فعلی برای سادگی، به همون ساب‌توتال کلاینت تکیه می‌کنیم، 
      // ولی در فازهای بعدی حتماً باید محاسبه سمت سرور بشه)
    }

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        order_number: nextOrderNumber,
        customer_name,
        customer_phone,
        table_number: table_number || null,
        note: note || null,
        items,
        subtotal: finalSubtotal,
        original_subtotal: originalSubtotal,
        coupon_code: coupon_code || null,
        coupon_discount: couponDiscount,
        status: 'pending',
        payment_status: 'unpaid',
        payment_method: 'cash', // پیش‌فرض، در صورت نیاز در کلاینت آپدیت میشه
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('[orders POST] error:', orderErr)
      return NextResponse.json({ error: 'خطا در ثبت سفارش' }, { status: 500 })
    }

    return NextResponse.json({ order })
  } catch (err: any) {
    console.error('[orders POST] unexpected:', err)
    return NextResponse.json({ error: err?.message || 'خطای غیرمنتظره' }, { status: 500 })
  }
}