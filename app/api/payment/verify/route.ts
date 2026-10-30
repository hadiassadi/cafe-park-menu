import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/orders/owner'
import { verifyZarinPalPayment } from '@/lib/payment/zarinpal'

export const dynamic = 'force-dynamic'

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function back(code: string, orderId?: string, extra?: Record<string, string>) {
  const p = new URLSearchParams({ status: code })
  if (orderId) p.set('orderId', orderId)
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v)
  return NextResponse.redirect(`${siteUrl()}/payment/callback?${p.toString()}`)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const authority = searchParams.get('Authority')
    const status = searchParams.get('Status')
    const paymentId = searchParams.get('paymentId')

    if (!authority || authority.length > 64) {
      return back('error', undefined, { code: 'no_authority' })
    }
    if (!paymentId || !UUID_RE.test(paymentId)) {
      return back('error', undefined, { code: 'bad_order' })
    }

    const db = supabaseAdmin()

    const { data: payment, error: payErr } = await db
      .from('order_payments')
      .select('id, order_id, method, amount, status, authority')
      .eq('id', paymentId)
      .maybeSingle()

    if (payErr || !payment) {
      return back('error', undefined, { code: 'order_not_found' })
    }
    const orderId = payment.order_id as string

    if (payment.method !== 'online' || !payment.authority || payment.authority !== authority) {
      console.error('[payment/verify] authority mismatch', { paymentId })
      return back('error', orderId, { code: 'authority_mismatch' })
    }

    // قبلاً تأیید شده
    if (payment.status === 'confirmed') {
      return back('already-paid', orderId)
    }
    // فقط پرداخت در حال انتظار قابل تأیید است
    if (payment.status !== 'pending') {
      return back('error', orderId, { code: 'verify_failed' })
    }

    const markFinal = async (newStatus: 'failed', reason: string) => {
      const { error } = await db.rpc('set_order_payment_status', {
        p_payment_id: payment.id,
        p_new_status: newStatus,
        p_reason: reason,
      })
      if (error && !String(error.message).includes('payment_already_final')) {
        console.error('[payment/verify] mark failed:', error)
      }
    }

    // کاربر در درگاه انصراف داد
    if (status !== 'OK') {
      await markFinal('failed', 'user_cancelled')
      return back('cancelled', orderId)
    }

    const amount = Number(payment.amount)
    if (!Number.isInteger(amount) || amount <= 0) {
      console.error('[payment/verify] invalid stored amount', { paymentId })
      return back('error', orderId, { code: 'bad_amount' })
    }

    const { data: settings, error: settingsErr } = await db
      .from('settings')
      .select('payment_merchant_id, payment_sandbox_mode')
      .eq('id', 1)
      .single()

    if (settingsErr || !settings?.payment_merchant_id) {
      return back('error', orderId, { code: 'settings' })
    }

    const result = await verifyZarinPalPayment(
      {
        merchantId: settings.payment_merchant_id,
        sandbox: !!settings.payment_sandbox_mode,
      },
      authority,
      amount
    )

    if (!result.success) {
      if (result.retryable) {
        // وضعیت نامعلوم است؛ ردیف را failed نکنید
        console.error('[payment/verify] retryable failure', { paymentId })
        return back('pending', orderId)
      }
      await markFinal('failed', 'verify_rejected')
      return back('error', orderId, { code: 'verify_failed' })
    }

    // ثبت موفقیت (اتمیک)
    const { error: confirmErr } = await db.rpc('set_order_payment_status', {
      p_payment_id: payment.id,
      p_new_status: 'confirmed',
      p_ref_id: result.refId,
    })

    if (confirmErr) {
      if (String(confirmErr.message).includes('payment_already_final')) {
        return back('already-paid', orderId)
      }
      // پول تأیید شده ولی ثبت نشد: حتماً در لاگ بماند
      console.error('[payment/verify] CRITICAL paid but not saved', {
        paymentId,
        orderId,
        refId: result.refId,
        confirmErr,
      })
      return back('error', orderId, { code: 'save_failed', refId: result.refId })
    }

    return back('success', orderId, { refId: result.refId })
  } catch (err) {
    console.error('[payment/verify]', err)
    return back('error', undefined, { code: 'unexpected' })
  }
}
