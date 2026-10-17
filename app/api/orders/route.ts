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
    const cookieStore = await cookies()
    
    // ✅ بررسی کوکی دستگاه
    let deviceToken = cookieStore.get('cafe_device_token')?.value
    let isNewToken = false

    if (!deviceToken) {
      deviceToken = crypto.randomBytes(32).toString('hex')
      isNewToken = true
    }

    // هش کردن توکن برای ذخیره در دیتابیس
    const deviceIdHash = crypto.createHash('sha256').update(deviceToken).digest('hex')

    // ۱. تولید شماره سفارش
    const { data: lastOrder } = await db
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrderNumber = (lastOrder?.order_number || 1000) + 1

    // ۲. ثبت سفارش در دیتابیس
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        order_number: nextOrderNumber,
        customer_name,
        customer_phone,
        table_number: table_number || null,
        note: note || null,
        items,
        subtotal,
        coupon_code: coupon_code || null,
        status: 'pending',
        payment_status: 'unpaid',
        payment_method: 'cash',
        device_id_hash: deviceIdHash, // ✅ ذخیره هش دستگاه
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('[orders POST] error:', orderErr)
      return NextResponse.json({ error: 'خطا در ثبت سفارش' }, { status: 500 })
    }

    // ۳. ساخت پاسخ و ست کردن کوکی در صورت جدید بودن
    const response = NextResponse.json({ order })

    if (isNewToken) {
      response.cookies.set('cafe_device_token', deviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // ۱ سال
        path: '/',
      })
    }

    return response
  } catch (err: any) {
    console.error('[orders POST] unexpected:', err)
    return NextResponse.json({ error: err?.message || 'خطای غیرمنتظره' }, { status: 500 })
  }
}