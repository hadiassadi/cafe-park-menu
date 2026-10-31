import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'
import { requestZarinPalPayment } from '@/lib/payment/zarinpal'
import { paymentErrorMessage } from '@/lib/payment/methods'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'شناسه سفارش نامعتبر است' }, { status: 400 })
    }

    // مبلغ اختیاری است؛ اگر نیامد، کل باقی‌مانده پرداخت می‌شود
    let requestedAmount: number | null = null
    if (body?.amount !== undefined && body?.amount !== null) {
      if (!Number.isInteger(body.amount) || body.amount <= 0) {
        return NextResponse.json({ error: 'مبلغ نامعتبر است' }, { status: 400 })
      }
      requestedAmount = body.amount
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) {
      console.error('[payment/request] NEXT_PUBLIC_SITE_URL is not set')
      return NextResponse.json({ error: 'خطای پیکربندی سرور' }, { status: 500 })
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, order_number, subtotal, status, deleted_at, customer_phone')
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .maybeSingle()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    if (order.deleted_at || order.status === 'cancelled') {
      return NextResponse.json({ error: 'این سفارش لغو یا حذف شده است' }, { status: 400 })
    }

    // تنظیمات درگاه
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

    // باقی‌مانده = مبلغ سفارش − پرداخت‌های تأییدشده
    const { data: confirmedRows, error: sumErr } = await db
      .from('order_payments')
      .select('amount')
      .eq('order_id', order.id)
      .eq('status', 'confirmed')
    if (sumErr) {
      console.error('[payment/request] sum:', sumErr)
      return NextResponse.json({ error: 'خطا در خواندن پرداخت‌ها' }, { status: 500 })
    }
    const paid = (confirmedRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const remaining = Number(order.subtotal) - paid

    if (remaining <= 0) {
      return NextResponse.json({ error: 'این سفارش قبلاً تسویه شده' }, { status: 400 })
    }

    const amount = requestedAmount ?? remaining
    if (amount > remaining) {
      return NextResponse.json({ error: 'مبلغ بیشتر از باقی‌مانده سفارش است' }, { status: 400 })
    }

    // ۱) رزرو مبلغ در دفتر (اتمیک)
    const { data: paymentId, error: addErr } = await db.rpc('add_order_payment', {
      p_order_id: order.id,
      p_method: 'online',
      p_amount: amount,
      p_created_by: 'customer',
      p_status: 'pending',
    })
    if (addErr || !paymentId) {
      console.error('[payment/request] add_order_payment:', addErr)
      return NextResponse.json({ error: paymentErrorMessage(addErr?.message) }, { status: 400 })
    }

    const failPayment = async (reason: string) => {
      const { error } = await db.rpc('set_order_payment_status', {
        p_payment_id: paymentId,
        p_new_status: 'failed',
        p_reason: reason,
      })
      if (error) console.error('[payment/request] mark failed:', error)
    }

    // ۲) درخواست به درگاه
    const callbackUrl = `${siteUrl.replace(/\/$/, '')}/api/payment/verify?paymentId=${paymentId}`
    const result = await requestZarinPalPayment(
      {
        merchantId: settings.payment_merchant_id,
        sandbox: !!settings.payment_sandbox_mode,
      },
      amount,
      callbackUrl,
      `سفارش #${order.order_number} - کافه پارک`,
      order.customer_phone
    )

    if (!result.success) {
      console.error('[payment/request] gateway error:', result.error)
      await failPayment('gateway_error')
      return NextResponse.json({ error: 'ایجاد تراکنش ناموفق بود' }, { status: 502 })
    }

    // ۳) ذخیرهٔ Authority روی ردیف پرداخت
    const { error: saveErr } = await db
      .from('order_payments')
      .update({ authority: result.authority, updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .eq('status', 'pending')

    if (saveErr) {
      console.error('[payment/request] save authority failed:', saveErr)
      await failPayment('save_authority_failed')
      return NextResponse.json({ error: 'خطا در ثبت تراکنش' }, { status: 500 })
    }

    return NextResponse.json({ success: true, paymentUrl: result.paymentUrl })
  } catch (err: any) {
    console.error('[payment/request] error:', err)
    return apiError(err)
  }
}
