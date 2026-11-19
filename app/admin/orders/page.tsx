import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import OrdersManager from './OrdersManager'
import PendingRefundsBanner from './PendingRefundsBanner'

export const metadata: Metadata = {
  title: 'سفارش ها',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return (
      <main className="admin">
        <h1>مدیریت سفارش‌ها</h1>
        <p className="danger">
          تنظیمات سرور ناقص است (Service Role Key وجود ندارد).
        </p>
      </main>
    )
  }

  const db = createClient(url, key, { auth: { persistSession: false } })

  const [ordersResult, settingsResult] = await Promise.all([
    db
      .from('orders')
      .select('*')
      // 🎯 پچ ۵۰-هـ-ع: سفارش‌های نهایی‌شدهٔ مشتری (customer_confirmed) و
      // پرداخت‌های ترکیبیِ partial هم به پنل مدیر بیایند — قبلاً split+unpaid
      // فیلتر می‌شد و «پرداخت در محل» ترکیبی اصلاً دیده نمی‌شد
      .or(
        'payment_method.in.(cash,card),payment_method.is.null,payment_status.eq.paid,payment_status.eq.partial,customer_confirmed.eq.true,and(payment_status.eq.pending_review,or(payment_receipt_url.not.is.null,payment_note.not.is.null))'
      )
      .order('created_at', { ascending: false })
      .limit(200),

    db
      .from('settings')
      .select('admin_allow_delete_orders')
      .eq('id', 1)
      .maybeSingle(),
  ])

  if (ordersResult.error) {
    return (
      <main className="admin">
        <h1>مدیریت سفارش‌ها</h1>
        <p className="danger">{ordersResult.error.message}</p>
      </main>
    )
  }

  const rawOrders = ordersResult.data ?? []

  // جمع پرداخت‌های تأییدشدهٔ هر سفارش از دفتر پرداخت
  // 🎯 پچ ۵۰-هـ-ف: خودِ ردیف‌ها هم (روش/مبلغ/زمان) برای نمایش شفاف در جزییات
  const paidByOrder: Record<string, number> = {}
  const ledgerByOrder: Record<
    string,
    Array<{
      method: string | null
      amount: number
      status: string | null
      created_at: string | null
    }>
  > = {}
  if (rawOrders.length > 0) {
    const { data: payments, error: payErr } = await db
      .from('order_payments')
      .select('order_id, amount, method, status, created_at')
      .in(
        'order_id',
        rawOrders.map((o: any) => o.id)
      )
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })

    if (payErr) {
      return (
        <main className="admin">
          <h1>مدیریت سفارش‌ها</h1>
          <p className="danger">{payErr.message}</p>
        </main>
      )
    }

    for (const p of payments ?? []) {
      const amount = Number(p.amount)
      paidByOrder[p.order_id] = (paidByOrder[p.order_id] ?? 0) + amount
      ;(ledgerByOrder[p.order_id] ??= []).push({
        method: p.method ?? null,
        amount,
        status: p.status ?? null,
        created_at: p.created_at ?? null,
      })
    }
  }

  const orders = rawOrders.map((o: any) => ({
    ...o,
    paid_amount: paidByOrder[o.id] ?? 0,
    order_payments: ledgerByOrder[o.id] ?? [],
  }))

  const allowDeleteOrders =
    settingsResult.data?.admin_allow_delete_orders ?? true
  const { data: refundRows, error: refundErr } = await db
    .from('order_refunds')
    .select('id, order_number, amount, method, created_at')
    .eq('status', 'pending_manual')
    .order('created_at', { ascending: true })
  if (refundErr) console.error('[orders page] pending refunds:', refundErr)

  const pendingRefunds = (refundRows ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount),
  }))

  // 🎯 پچ ۵۱: نقشهٔ اپراتورها (نام + کد) — برای نشانِ ثبت‌کننده روی سفارش‌ها
  let operatorsMap: Record<string, { name: string; code?: string | null }> = {}
  try {
    const [usersRes, profilesRes] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 500 }),
      db.from('admin_operator_profiles').select('user_id, code'),
    ])
    const codeByUser: Record<string, string> = {}
    for (const p of profilesRes.data ?? []) {
      codeByUser[(p as any).user_id] = (p as any).code
    }
    for (const u of usersRes.data?.users ?? []) {
      const meta = (u as any).user_metadata ?? {}
      operatorsMap[u.id] = {
        name:
          (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
          u.email ||
          'کاربر',
        code: codeByUser[u.id] ?? null,
      }
    }
  } catch (e) {
    console.error('[orders page] operators map:', e)
  }

  return (
    <main className="admin">
      <PendingRefundsBanner refunds={pendingRefunds} />
      <OrdersManager
        orders={orders}
        allowDeleteOrders={allowDeleteOrders}
        operatorsMap={operatorsMap}
      />

    </main>
  )
}
