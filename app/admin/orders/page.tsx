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

  const allowDeleteOrders =
    settingsResult.data?.admin_allow_delete_orders ?? true

  return (
    <main className="admin">
      <OrdersManager
        orders={ordersResult.data ?? []}
        allowDeleteOrders={allowDeleteOrders}
      />
    </main>
  )
}