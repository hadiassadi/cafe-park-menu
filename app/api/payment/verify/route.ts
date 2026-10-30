import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyZarinPalPayment } from '@/lib/payment/zarinpal'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

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
    const orderId = searchParams.get('orderId')

    if (!authority || authority.length > 64) {
      return back('error', undefined, { code: 'no_authority' })
    }
    if (!orderId || !UUID_RE.test(orderId)) {
      return back('error', undefined, { code: 'bad_order' })
    }

    const db = createDb()

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, payment_status, payment_authority, payment_amount')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return back('error', undefined, { code: 'order_not_found' })
    }

    // قبلاً پرداخت شده: هیچ تغییری روی سفارش انجام نشود
    if (order.payment_status === 'paid') {
      return back('already-paid', order.id)
    }

    // Authority باید همان چیزی باشد که برای این سفارش ساخته شده
    if (!order.payment_authority || order.payment_authority !== authority) {
      console.error('[payment/verify] authority mismatch', { orderId: order.id })
      return back('error', order.id, { code: 'authority_mismatch' })
    }

    // کاربر لغو کرد
    if (status !== 'OK') {
      await db
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id)
        .eq('payment_authority', authority)
        .neq('payment_status', 'paid')
      return back('cancelled', order.id)
    }

    if (!Number.isInteger(order.payment_amount) || order.payment_amount <= 0) {
      console.error('[payment/verify] invalid stored amount', { orderId: order.id })
      return back('error', order.id, { code: 'bad_amount' })
    }

    const { data: settings, error: settingsErr } = await db
      .from('settings')
      .select('payment_merchant_id, payment_sandbox_mode')
      .eq('id', 1)
      .single()

    if (settingsErr || !settings?.payment_merchant_id) {
      return back('error', order.id, { code: 'settings' })
    }

    const result = await verifyZarinPalPayment(
      {
        merchantId: settings.payment_merchant_id,
        sandbox: !!settings.payment_sandbox_mode,
      },
      authority,
      order.payment_amount
    )

    if (!result.success) {
      if (result.retryable) {
        // وضعیت نامعلوم است؛ سفارش را failed نکنید
        console.error('[payment/verify] retryable failure', { orderId: order.id })
        return back('pending', order.id)
      }
      await db
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id)
        .eq('payment_authority', authority)
        .neq('payment_status', 'paid')
      return back('error', order.id, { code: 'verify_failed' })
    }

    // ثبت موفقیت: فقط اگر هنوز paid نشده باشد
    const { data: updated, error: updErr } = await db
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_ref_id: result.refId,
        payment_verified_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('payment_authority', authority)
      .neq('payment_status', 'paid')
      .select('id')

    if (updErr) {
      // پول تأیید شده ولی ثبت نشد: حتماً در لاگ بماند
      console.error('[payment/verify] CRITICAL paid but not saved', {
        orderId: order.id,
        refId: result.refId,
        updErr,
      })
      return back('error', order.id, { code: 'save_failed', refId: result.refId })
    }

    if (!updated || updated.length === 0) {
      return back('already-paid', order.id)
    }

    return back('success', order.id, { refId: result.refId })
  } catch (err) {
    console.error('[payment/verify]', err)
    return back('error', undefined, { code: 'unexpected' })
  }
}
