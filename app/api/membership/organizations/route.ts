import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = supabaseAdmin()
    
    const { data, error } = await db
      .from('organizations')
      .select('id, name, expires_at, is_active')

    if (error) {
      console.error('Fetch Orgs Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = new Date()
    const activeOrgs = data.filter(org => {
      const isActive = org.is_active === true
      const expires = new Date(org.expires_at)
      const isNotExpired = expires > now
      return isActive && isNotExpired
    })

    return NextResponse.json({ organizations: activeOrgs })
  } catch (err) {
    console.error('[Organizations API] Error:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}