import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params
    const db = supabaseAdmin()
    
    const { data, error } = await db
      .from('organization_members')
      .select('id, metadata, is_registered, device_id_hash, created_at')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Members GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ members: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
