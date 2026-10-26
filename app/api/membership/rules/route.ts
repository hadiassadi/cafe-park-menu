import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db
      .from('settings')
      .select('membership_rules_general, membership_rules_org')
      .eq('id', 1)
      .single()

    if (error) {
      console.error('Rules Error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    return NextResponse.json({ 
      general: data.membership_rules_general,
      org: data.membership_rules_org
    })
  } catch {
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}