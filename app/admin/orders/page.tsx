import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'سفارش ها',
  robots: { index: false, follow: false },
}
import { supabaseServer } from '@/lib/supabase/server'
import OrdersManager from './OrdersManager'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const db = await supabaseServer()

  const { data: orders, error } = await db
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return (
      <main className="admin">
        <h1>مدیریت سفارش‌ها</h1>
        <p className="danger">{error.message}</p>
      </main>
    )
  }

  return (
    <main className="admin">
      <OrdersManager orders={orders ?? []} />
    </main>
  )
}