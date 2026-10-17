import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requestZarinPalPayment } from '@/lib/payment/zarinpal'

export const dynamic = 'force-dynamic'

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const orderId = body.orderId

    if (!orderId) {
      return NextResponse.json({ error: 'شناسه سفارش الزامی است' }, { status: 400 })
    }

    const db = createDb()

    // ۱. خواندن سفارش
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, order_number, subtotal, payment_status, customer_phone')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'این سفارش قبلاً پرداخت شده' }, { status: 400 })
    }

    // ۲. خواندن تنظیمات (✅ ستون payment_merchant_id برگشت)
    const { data: settings, error: settingsErr } = await db
      .from('settings')
      .select('payment_enabled, payment_online_enabled, payment_gateway, payment_merchant_id, payment_sandbox_mode')
      .eq('id', 1)
      .single()

    if (settingsErr || !settings) {
      return NextResponse.json({ error: 'خطا در خواندن تنظیمات پرداخت' }, { status: 500 })
    }

    if (!settings.payment_enabled || !settings.payment_online_enabled) {
      return NextResponse.json({ error: 'پرداخت آنلاین غیرفعال است' }, { status: 400 })
    }

    if (settings.payment_gateway !== 'zarinpal') {
      return NextResponse.json({ error: `درگاه «${settings.payment_gateway}» هنوز پیاده‌سازی نشده` }, { status: 400 })
    }

    // ✅ استفاده از دیتابیس به جای متغیر محیطی (چون جدول قفل شده و امن است)
    const merchantId = settings.payment_merchant_id

    if (!merchantId) {
      return NextResponse.json({ error: 'Merchant ID در تنظیمات پرداخت ثبت نشده است' }, { status: 400 })
    }

    // ۳. ساخت callback URL
    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000'
    const callbackUrl = `${origin}/api/payment/verify?orderId=${orderId}`

    // ۴. درخواست پرداخت
    const result = await requestZarinPalPayment(
      {
        merchantId,
        sandbox: !!settings.payment_sandbox_mode,
      },
      order.subtotal,
      callbackUrl,
      `سفارش #${order.order_number} - کافه پارک`,
      order.customer_phone
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // ۵. ذخیره authority در سفارش
    await db
      .from('orders')
      .update({
        payment_method: 'online',
        payment_status: 'unpaid',
        payment_authority: result.authority,
        payment_amount: order.subtotal,
      })
      .eq('id', orderId)

    return NextResponse.json({
      success: true,
      paymentUrl: result.paymentUrl,
      authority: result.authority,
    })
  } catch (err: any) {
    console.error('[payment/request] error:', err)
    return NextResponse.json({ error: err?.message || 'خطای غیرمنتظره' }, { status: 500 })
  }
}