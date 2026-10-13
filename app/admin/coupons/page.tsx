import { supabaseServer } from '@/lib/supabase/server'
import CouponsManager from './CouponsManager'

export const dynamic = 'force-dynamic'

export default async function CouponsPage() {
  const db = await supabaseServer()

  const { data: coupons, error } = await db
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="admin">
        <h1>مدیریت کدهای تخفیف</h1>
        <p className="danger">{error.message}</p>
      </main>
    )
  }

  return (
    <main className="admin">
      <CouponsManager coupons={coupons ?? []} />
    </main>
  )
}