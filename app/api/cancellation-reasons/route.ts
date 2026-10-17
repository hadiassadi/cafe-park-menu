import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('target') || 'customer'

  if (!['customer', 'admin'].includes(target)) {
    return NextResponse.json({ error: 'نوع نامعتبر' }, { status: 400 })
  }

  try {
    const db = createAdminDb()
    const { data, error } = await db
      .from('cancellation_reasons')
      .select('id, label, target, icon, sort_order, is_active')
      .eq('is_active', true)
      .in('target', [target, 'both'])
      .order('sort_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ reasons: data ?? [] })
  } catch (err) {
    console.error('[cancellation-reasons API] error:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}