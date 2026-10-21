import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = supabaseAdmin()
  const { data } = await db.from('settings').select('membership_rules_general, membership_rules_org').eq('id', 1).single()
  return NextResponse.json(data || {})
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const db = supabaseAdmin()
    
    const { error } = await db.from('settings').update({
      membership_rules_general: body.general,
      membership_rules_org: body.org
    }).eq('id', 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}