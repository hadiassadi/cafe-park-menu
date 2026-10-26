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
  const { data, error } = await db.from('membership_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
  if (error) return apiError(error, 'خطای پایگاه داده')
  return NextResponse.json({ requests: data || [] })
}
