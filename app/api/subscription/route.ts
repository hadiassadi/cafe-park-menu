import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveWalletCustomer } from '@/lib/wallet/wallet'
import { getSubscriptionFlags } from '@/lib/subscriptions/subscriptions'
import { UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

/** پلن‌های فعال + وضعیت اشتراک و درخواستِ در انتظارِ مشتری — GET */
export async function GET() {
  try {
    const [flags, { data: plans }] = await Promise.all([
      getSubscriptionFlags(),
      supabaseAdmin()
        .from('subscription_plans')
        .select('id, name, price, duration_days, discount_percent, benefits, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('price', { ascending: true })
        .limit(20),
    ])

    const customer = await resolveWalletCustomer()
    if (!customer) {
      return NextResponse.json(
        { subscriptionEnabled: flags.subscriptionEnabled, plans: plans ?? [], customer: null, subscription: null, pendingRequest: null },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const [sub, pending] = await Promise.all([
      supabaseAdmin()
        .from('customer_subscriptions')
        .select('id, plan_name, discount_percent, ends_at, source')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin()
        .from('wallet_charge_requests')
        .select('id, status, plan_name, reject_reason, created_at')
        .eq('customer_id', customer.id)
        .eq('purpose', 'subscription')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    return NextResponse.json(
      {
        subscriptionEnabled: flags.subscriptionEnabled,
        plans: plans ?? [],
        customer: { name: customer.name, wallet_blocked: !!customer.wallet_blocked },
        subscription: sub.data ?? null,
        pendingRequest: pending.data ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[subscription][GET]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}

/**
 * خرید اشتراک با موجودی کیف پول — POST { plan_id }
 * کسر مبلغ + ساخت اشتراک در یک RPC اتمیک انجام می‌شود.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'subscription-buy', 5, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const planId = typeof body?.plan_id === 'string' ? body.plan_id : ''
    if (!UUID_RE.test(planId)) {
      return NextResponse.json({ error: 'پلن نامعتبر است' }, { status: 400 })
    }

    const flags = await getSubscriptionFlags()
    if (!flags.subscriptionEnabled) {
      return NextResponse.json({ error: 'خرید اشتراک فعلاً فعال نیست' }, { status: 403 })
    }

    const customer = await resolveWalletCustomer()
    if (!customer) {
      return NextResponse.json(
        { error: 'برای خرید اشتراک اول با شماره موبایل وارد شو' },
        { status: 401 }
      )
    }
    if (customer.wallet_blocked) {
      return NextResponse.json({ error: 'کیف پول شما توسط مدیر مسدود شده است' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin().rpc('purchase_subscription_with_wallet', {
      p_customer_id: customer.id,
      p_plan_id: planId,
    })

    if (error) {
      console.error('[subscription] buy rpc:', error.message)
      const msg = error.message
      if (msg.includes('insufficient_balance')) {
        return NextResponse.json({ error: 'موجودی کیف پول برای این پلن کافی نیست؛ اول کیف پول را شارژ کن' }, { status: 400 })
      }
      if (msg.includes('already_active')) {
        return NextResponse.json({ error: 'شما یک اشتراک فعال دارید؛ بعد از پایان می‌توانید تمدید کنید' }, { status: 409 })
      }
      if (msg.includes('plan_not_found')) {
        return NextResponse.json({ error: 'این پلن در دسترس نیست' }, { status: 400 })
      }
      return NextResponse.json({ error: 'خطا در خرید اشتراک' }, { status: 500 })
    }

    const row = Array.isArray(data) ? data[0] : data
    return NextResponse.json({
      ok: true,
      subscription: {
        id: String(row?.subscription_id ?? ''),
        ends_at: row?.ends_at ?? null,
      },
    })
  } catch (err) {
    console.error('[subscription][POST]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
