import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = supabaseAdmin()
    const now = new Date().toISOString()

    // فقط سازمان‌هایی که فعالن و تاریخ انقضاشون نگذشته
    const { data, error } = await db
      .from('organizations')
      .select('id, name')
      .eq('is_active', true)
      .gt('expires_at', now)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ organizations: data || [] })
  } catch (err) {
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
