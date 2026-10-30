import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requestZarinPalPayment } from '@/lib/payment/zarinpal'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 })
    }

    const orderId = body?.orderId
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'شناسه سفارش نامعتبر است' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) {
      console.error('[payment/request] NEXT_PUBLIC_SITE_URL is not set')
      return NextResponse.json({ error: 'خطای پیکربندی سرور' }, { status: 500 })
    }

    const db = createDb()

    // جایگزینی ۱ از ۳: اگر ستون مبلغ نهایی دارید، subtotal را اینجا عوض کنید
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, order_number, subtotal, payment_status, customer_phone')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    // TODO: سفارش لغوشده یا soft-delete‌شده را هم رد کنید

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'این سفارش قبلاً پرداخت شده' }, { status: 400 })
    }

    // جایگزینی ۲ از ۳
    if (!Number.isInteger(order.subtotal) || order.subtotal <= 0) {
      return NextResponse.json({ error: 'مبلغ سفارش نامعتبر است' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'درگاه پرداخت پشتیبانی نمی‌شود' }, { status: 400 })
    }

    if (!settings.payment_merchant_id) {
      return NextResponse.json({ error: 'Merchant ID در تنظیمات پرداخت ثبت نشده است' }, { status: 400 })
    }

    const callbackUrl = `${siteUrl.replace(/\/$/, '')}/api/payment/verify?orderId=${order.id}`

    // جایگزینی ۳ از ۳: مبلغ ارسالی به درگاه
    const result = await requestZarinPalPayment(
      {
        merchantId: settings.payment_merchant_id,
        sandbox: !!settings.payment_sandbox_mode,
      },
      order.subtotal,
      callbackUrl,
      `سفارش #${order.order_number} - کافه پارک`,
      order.customer_phone
    )

    if (!result.success) {
      console.error('[payment/request] gateway error:', result.error)
      return NextResponse.json({ error: 'ایجاد تراکنش ناموفق بود' }, { status: 502 })
    }

    const { error: saveErr } = await db
      .from('orders')
      .update({
        payment_method: 'online',
        payment_status: 'unpaid',
        payment_authority: result.authority,
        payment_amount: order.subtotal,
      })
      .eq('id', order.id)
      .neq('payment_status', 'paid')

    if (saveErr) {
      console.error('[payment/request] save authority failed:', saveErr)
      return NextResponse.json({ error: 'خطا در ثبت تراکنش' }, { status: 500 })
    }

    return NextResponse.json({ success: true, paymentUrl: result.paymentUrl })
  } catch (err: any) {
    console.error('[payment/request] error:', err)
    return apiError(err)
  }
}
