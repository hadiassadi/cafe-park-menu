import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isPaymentMethod, paymentErrorMessage } from '@/lib/payment/methods'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 🎯 پچ ۵۰-هـ-خ: ثبت پرداخت روی سفارش از خود POS — برای تسویهٔ بخشی/کاملِ
// فاکتور اصلی یا ضمیمه‌ها. همان RPC پنل مدیریت (add_order_payment) با status
// confirmed؛ روی پرداخت لغو/حذف‌شده و مبلغِ بیشتر از باقی‌مانده خطا می‌دهد.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.denied) return auth.denied

    const rl = rateLimit(req, 'admin-pos-order-payment', 30, 60_000)
    if (!rl.ok) return tooMany(rl)

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'شناسهٔ سفارش نامعتبر است' }, { status: 400 })
    }

    const body: any = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 })
    }

    const method = body?.method
    if (!isPaymentMethod(method)) {
      return NextResponse.json({ error: 'روش پرداخت نامعتبر است' }, { status: 400 })
    }

    const amount = Math.floor(Number(body?.amount))
    if (!Number.isFinite(amount) || amount <= 0 || amount > 500_000_000) {
      return NextResponse.json({ error: 'مبلغ پرداخت نامعتبر است' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // سفارش: فقط زنده‌ها
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, subtotal, status, payment_method')
      .eq('id', id)
      .maybeSingle()
    if (orderErr || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    if ((order as any).status === 'cancelled') {
      return NextResponse.json({ error: 'این سفارش لغو شده است' }, { status: 400 })
    }

    // باقی‌مانده = مبلغ − پرداخت‌های تأییدشده
    const { data: pays, error: paysErr } = await db
      .from('order_payments')
      .select('amount')
      .eq('order_id', id)
      .eq('status', 'confirmed')
    if (paysErr) {
      return NextResponse.json({ error: 'خطا در خواندن پرداخت‌ها' }, { status: 500 })
    }
    const paid = (pays ?? []).reduce((s, r) => s + Number((r as any).amount), 0)
    const remaining = Math.max(0, Math.round(Number((order as any).subtotal) - paid))
    if (remaining <= 0) {
      return NextResponse.json({ error: 'این فاکتور قبلاً تسویه شده است' }, { status: 400 })
    }
    if (amount > remaining) {
      return NextResponse.json(
        { error: `مبلغ بیشتر از باقی‌مانده است (باقی‌مانده: ${remaining})` },
        { status: 400 }
      )
    }

    // ثبت پرداخت — همان RPC پنل مدیریت
    const { error: payErr } = await db.rpc('add_order_payment', {
      p_order_id: id,
      p_method: method,
      p_amount: amount,
      p_created_by: 'admin',
      p_status: 'confirmed',
      p_note: 'ثبت از POS',
    })
    if (payErr) {
      console.error('[admin orders payment] rpc:', payErr)
      return NextResponse.json({ error: paymentErrorMessage(payErr.message) }, { status: 400 })
    }

    // روش پرداخت سفارش را هم به‌روز کن (فیلدهای جانبی مثل پنل مدیریت)
    const { error: updErr } = await db
      .from('orders')
      .update({
        payment_method: method,
        payment_verified_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (updErr) {
      console.error('[admin orders payment] side update:', updErr)
    }

    return NextResponse.json({
      ok: true,
      paid: paid + amount,
      remaining: remaining - amount,
    })
  } catch (err) {
    console.error('[admin orders payment] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
