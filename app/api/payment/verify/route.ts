import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyZarinPalPayment } from '@/lib/payment/zarinpal'

export const dynamic = 'force-dynamic'

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'

  try {
    const { searchParams } = new URL(req.url)
    const authority = searchParams.get('Authority')
    const status = searchParams.get('Status')
    const orderId = searchParams.get('orderId')

    if (!authority) {
      return NextResponse.redirect(
        `${origin}/payment/callback?status=error&message=${encodeURIComponent('کد Authority دریافت نشد')}`
      )
    }

    if (!orderId) {
      return NextResponse.redirect(
        `${origin}/payment/callback?status=error&message=${encodeURIComponent('شناسه سفارش دریافت نشد')}`
      )
    }

    const db = createDb()

    // ۱. پیدا کردن سفارش با orderId
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, order_number, subtotal, payment_status')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.redirect(
        `${origin}/payment/callback?status=error&message=${encodeURIComponent('سفارش پیدا نشد')}`
      )
    }

    // ۲. کاربر لغو کرد
    if (status !== 'OK') {
      await db.from('orders').update({ payment_status: 'failed' }).eq('id', order.id)
      return NextResponse.redirect(
        `${origin}/payment/callback?status=cancelled&orderId=${order.id}`
      )
    }

    // ۳. قبلاً پرداخت شده
    if (order.payment_status === 'paid') {
      return NextResponse.redirect(
        `${origin}/payment/callback?status=already-paid&orderId=${order.id}`
      )
    }

    // ۴. خواندن تنظیمات (✅ ستون payment_merchant_id حذف شد)
    const { data: settings, error: settingsErr } = await db
      .from('settings')
      .select('payment_sandbox_mode')
      .eq('id', 1)
      .single()

    if (settingsErr || !settings) {
      return NextResponse.redirect(
        `${origin}/payment/callback?status=error&message=${encodeURIComponent('خطا در خواندن تنظیمات')}&orderId=${order.id}`
      )
    }

    // ✅ استفاده از متغیر محیطی
    const merchantId = process.env.ZARINPAL_MERCHANT_ID

    if (!merchantId) {
      return NextResponse.redirect(
        `${origin}/payment/callback?status=error&message=${encodeURIComponent('Merchant ID روی سرور تنظیم نشده')}&orderId=${order.id}`
      )
    }

    // ۵. تأیید پرداخت
    const result = await verifyZarinPalPayment(
      {
        merchantId,
        sandbox: !!settings.payment_sandbox_mode,
      },
      authority,
      order.subtotal
    )

    if (!result.success) {
      await db.from('orders').update({ payment_status: 'failed' }).eq('id', order.id)
      return NextResponse.redirect(
        `${origin}/payment/callback?status=error&message=${encodeURIComponent(result.error)}&orderId=${order.id}`
      )
    }

    // ۶. ثبت موفقیت
    await db
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_ref_id: result.refId,
        payment_verified_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    // ۷. ریدایرکت
    return NextResponse.redirect(
      `${origin}/payment/callback?status=success&orderId=${order.id}&refId=${result.refId}`
    )
  } catch (err: any) {
    console.error('[payment/verify] error:', err)
    return NextResponse.redirect(
      `${origin}/payment/callback?status=error&message=${encodeURIComponent(err?.message || 'خطای غیرمنتظره')}`
    )
  }
}