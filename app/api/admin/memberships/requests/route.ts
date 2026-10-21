import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = supabaseAdmin()
    
    const { data, error } = await db
      .from('membership_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch Requests Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}