import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import OrdersManager from './OrdersManager'

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
      .or(
        'payment_method.in.(cash,card),payment_method.is.null,payment_status.eq.paid,and(payment_status.eq.pending_review,or(payment_receipt_url.not.is.null,payment_note.not.is.null))'
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
  const paidByOrder: Record<string, number> = {}
  if (rawOrders.length > 0) {
    const { data: payments, error: payErr } = await db
      .from('order_payments')
      .select('order_id, amount')
      .in(
        'order_id',
        rawOrders.map((o: any) => o.id)
      )
      .eq('status', 'confirmed')

    if (payErr) {
      return (
        <main className="admin">
          <h1>مدیریت سفارش‌ها</h1>
          <p className="danger">{payErr.message}</p>
        </main>
      )
    }

    for (const p of payments ?? []) {
      paidByOrder[p.order_id] =
        (paidByOrder[p.order_id] ?? 0) + Number(p.amount)
    }
  }

  const orders = rawOrders.map((o: any) => ({
    ...o,
    paid_amount: paidByOrder[o.id] ?? 0,
  }))

  const allowDeleteOrders =
    settingsResult.data?.admin_allow_delete_orders ?? true

  return (
    <main className="admin">
      <OrdersManager orders={orders} allowDeleteOrders={allowDeleteOrders} />
    </main>
  )
}
