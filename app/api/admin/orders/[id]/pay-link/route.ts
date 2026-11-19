import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requestZarinPalPayment } from '@/lib/payment/zarinpal'
import { paymentErrorMessage } from '@/lib/payment/methods'
import { resolveRequestOrigin } from '@/lib/site'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 🎯 پچ ۵۰-هـ-س — ساخت «لینک پرداخت» درگاه برای سفارش حضوری از مودال پرداخت ادمین
 * ادمین مبلغ دلخواه (اعلامی یا ماندهٔ فاکتور) را در ردیف درگاه وارد و لینک
 * زرین‌پال می‌سازد: ردیف پرداخت با status=pending روی دفتر ثبت می‌شود (برای
 * نمایش در «پیام‌های مالی» مشتری در آینده) و پس از پرداخت مشتری، callback
 * همان را تأیید می‌کند. ارسال پیامکی لینک تا راه‌اندازی بخش پیامک/پیام‌های
 * پنل مشتریان غیرفعال است (سمت کلاینت).
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.denied) return auth.denied

    const rl = rateLimit(req, 'admin-pos-order-pay-link', 15, 60_000)
    if (!rl.ok) return tooMany(rl)

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'شناسهٔ سفارش نامعتبر است' }, { status: 400 })
    }

    const body: any = await req.json().catch(() => null)
    const amount = Math.floor(Number(body?.amount))
    if (!Number.isFinite(amount) || amount < 1_000 || amount > 500_000_000) {
      return NextResponse.json(
        { error: 'مبلغ لینک پرداخت نامعتبر است (حداقل ۱٫۰۰۰ تومان)' },
        { status: 400 }
      )
    }

    const siteUrl = resolveRequestOrigin(req)
    const db = supabaseAdmin()

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, order_number, subtotal, status, deleted_at, customer_phone')
      .eq('id', id)
      .maybeSingle()

    if (orderErr) {
      console.error('[admin/pay-link] order read:', orderErr)
      return apiError(orderErr, 'خطای پایگاه داده')
    }
    if (!order || order.deleted_at) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    if (['cancelled', 'canceled'].includes(order.status)) {
      return NextResponse.json({ error: 'این سفارش لغو شده است' }, { status: 400 })
    }

    // تنظیمات درگاه — مثل مسیر مشتری
    const { data: settings, error: settingsErr } = await db
      .from('settings')
      .select(
        'payment_enabled, payment_online_enabled, payment_gateway, payment_merchant_id, payment_sandbox_mode'
      )
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
      return NextResponse.json(
        { error: 'Merchant ID در تنظیمات پرداخت ثبت نشده است' },
        { status: 400 }
      )
    }

    // مانده بر اساس پرداخت‌های تأییدشده (ردیف‌های pending لینک‌های قبلی مانع نیستند)
    const { data: confirmedRows, error: sumErr } = await db
      .from('order_payments')
      .select('amount')
      .eq('order_id', order.id)
      .eq('status', 'confirmed')
    if (sumErr) {
      console.error('[admin/pay-link] sum:', sumErr)
      return NextResponse.json({ error: 'خطا در خواندن پرداخت‌ها' }, { status: 500 })
    }
    const paid = (confirmedRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const remaining = Number(order.subtotal) - paid
    if (remaining <= 0) {
      return NextResponse.json({ error: 'این سفارش قبلاً تسویه شده' }, { status: 400 })
    }
    if (amount > remaining) {
      return NextResponse.json(
        { error: 'مبلغ بیشتر از باقی‌مانده سفارش است' },
        { status: 400 }
      )
    }

    // ۱) رزرو مبلغ روی دفتر (اتمیک) — pending تا تأیید callback
    const { data: paymentId, error: addErr } = await db.rpc('add_order_payment', {
      p_order_id: order.id,
      p_method: 'online',
      p_amount: amount,
      p_created_by: 'admin',
      p_status: 'pending',
    })
    if (addErr || !paymentId) {
      console.error('[admin/pay-link] add_order_payment:', addErr)
      return NextResponse.json({ error: paymentErrorMessage(addErr?.message) }, { status: 400 })
    }

    // 🎯 پچ ۵۲: مهر اپراتور/شیفت روی ردیف لینک پرداخت — چه کسی لینک را صادر کرد
    try {
      const { data: openShift } = await db
        .from('shifts')
        .select('id')
        .eq('opened_by', auth.userId)
        .is('closed_at', null)
        .maybeSingle()
      await db.from('order_payments').update({
        operator_id: auth.userId,
        ...(openShift?.id ? { shift_id: openShift.id } : {}),
      }).eq('id', paymentId)
    } catch (stampErr) {
      console.error('[admin/pay-link] stamp:', stampErr)
    }

    const failPayment = async (reason: string) => {
      const { error } = await db.rpc('set_order_payment_status', {
        p_payment_id: paymentId,
        p_new_status: 'failed',
        p_reason: reason,
      })
      if (error) console.error('[admin/pay-link] mark failed:', error)
    }

    // ۲) درخواست لینک از درگاه
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
      console.error('[admin/pay-link] gateway error:', result.error)
      await failPayment('gateway_error')
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    // ۳) ذخیرهٔ Authority روی ردیف پرداخت
    const { error: saveErr } = await db
      .from('order_payments')
      .update({ authority: result.authority, updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .eq('status', 'pending')

    if (saveErr) {
      console.error('[admin/pay-link] save authority failed:', saveErr)
      await failPayment('save_authority_failed')
      return NextResponse.json({ error: 'خطا در ثبت تراکنش' }, { status: 500 })
    }

    return NextResponse.json({ success: true, paymentUrl: result.paymentUrl, paymentId })
  } catch (err) {
    console.error('[admin/pay-link] unexpected:', err)
    return apiError(err)
  }
}
