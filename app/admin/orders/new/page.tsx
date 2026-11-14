import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/server'
import NewOrderClient from './NewOrderClient'

export const metadata: Metadata = {
  title: 'ثبت سفارش حضوری',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function NewOrderPage() {
  // 🎯 پچ ۵۰-د: فهرست میزهای فعال برای انتخاب لمسی در POS
  const db = supabaseAdmin()
  const { data: tables } = await db
    .from('tables')
    .select('id, number, name, location, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('number', { ascending: true })

  return (
    <main className="admin">
      <NewOrderClient tables={tables ?? []} />
    </main>
  )
}
