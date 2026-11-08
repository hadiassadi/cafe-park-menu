import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'
import { resolveWalletCustomer } from '@/lib/wallet/wallet'
import { paymentErrorMessage } from '@/lib/payment/methods'

export const dynamic = 'force-dynamic'

/** موجودی کیف پول نشست فعلی — برای نمایش گزینه «پرداخت با کیف پول» در چک‌اوت */
export async function GET() {
  try {
    const customer = await resolveWalletCustomer()
    if (!customer) {
      return NextResponse.json(
        { balance: null, blocked: false },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { data, error } = await supabaseAdmin().rpc('wallet_balance', {
      p_customer_id: customer.id,
    })
    if (error) {
      console.error('[payment/wallet][GET] balance:', error.message)
      return NextResponse.json(
        { balance: null, blocked: !!customer.wallet_blocked },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      { balance: Number(data ?? 0), blocked: !!customer.wallet_blocked },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[payment/wallet][GET]', err)
    return NextResponse.json({ balance: null, blocked: false })
  }
}

/** پرداخت باقی‌مانده سفارش از کیف پول مشتری */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId

    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }

    // مشتری: نشست تأییدشده (OTP/دعوت) یا دستگاهِ مشتریِ احرازشده توسط ادمین
    const customer = await resolveWalletCustomer()
    if (!customer) {
      return NextResponse.json(
        { error: 'برای پرداخت با کیف پول اول باید شماره‌ات تأیید شود' },
        { status: 401 }
      )
    }
    if (customer.wallet_blocked) {
      return NextResponse.json(
        { error: 'کیف پول شما توسط مدیر مسدود شده است' },
        { status: 403 }
      )
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()

    // مالکیت سفارش با دستگاه + تطابق شماره سفارش با شماره کیف پول
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, customer_phone')
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .maybeSingle()

    if (orderErr) {
      console.error('[payment/wallet] order read:', orderErr.message)
      return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
    }
    if (!order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    if (order.customer_phone !== customer.phone) {
      return NextResponse.json(
        { error: 'برای پرداخت با کیف پول، شماره سفارش باید همان شماره تأییدشده باشد' },
        { status: 403 }
      )
    }

    const { data: result, error } = await db.rpc('pay_order_with_wallet', {
      p_order_id: orderId,
      p_device_hash: deviceHash,
    })

    if (error) {
      console.error('[payment/wallet] rpc:', error.message)
      return NextResponse.json(
        { error: paymentErrorMessage(error.message) },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      paid: Number(result?.paid ?? 0),
      balance: Number(result?.balance ?? 0),
    })
  } catch (err) {
    console.error('[payment/wallet]', err)
    return apiError(err)
  }
}
