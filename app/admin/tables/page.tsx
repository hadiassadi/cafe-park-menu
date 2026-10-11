import { supabaseServer } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import TablesManager from './TablesManager'

export const dynamic = 'force-dynamic'

export default async function TablesPage() {
  const db = await supabaseServer()

  const { data: tables, error } = await db
    .from('tables')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('number', { ascending: true })

  if (error) {
    return (
      <main className="admin">
        <h1>مدیریت میزها</h1>
        <p className="danger">{error.message}</p>
      </main>
    )
  }

  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const siteUrl = `${protocol}://${host}`

  return (
    <main className="admin">
      <TablesManager tables={tables ?? []} siteUrl={siteUrl} />
    </main>
  )
}