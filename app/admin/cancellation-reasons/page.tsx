import type { Metadata } from 'next'
import { supabaseServer } from '@/lib/supabase/server'
import CancellationReasonsManager from './CancellationReasonsManager'

export const metadata: Metadata = {
  title: 'دلایل لغو سفارش',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function CancellationReasonsPage() {
  const db = await supabaseServer()

  const { data: reasons, error } = await db
    .from('cancellation_reasons')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <main className="admin">
        <h1>دلایل لغو سفارش</h1>
        <p className="danger">{error.message}</p>
      </main>
    )
  }

  return (
    <main className="admin">
      <CancellationReasonsManager reasons={reasons ?? []} />
    </main>
  )
}