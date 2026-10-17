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
        <p className="danger">تنظیمات سرور ناقص است (Service Role Key وجود ندارد).</p>
      </main>
    )
  }

  const db = createClient(url, key, { auth: { persistSession: false } })

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