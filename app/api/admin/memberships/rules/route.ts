import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const db = supabaseAdmin()
  const { data } = await db.from('settings').select('membership_rules_general, membership_rules_org').eq('id', 1).single()
  return NextResponse.json(data || {})
}

export async function POST(req: Request) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const body = await req.json()
    const db = supabaseAdmin()
    
    const { error } = await db.from('settings').update({
      membership_rules_general: body.general,
      membership_rules_org: body.org
    }).eq('id', 1)

    if (error) return apiError(error, 'خطای پایگاه داده')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
