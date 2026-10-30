import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase env variables are missing')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = createAdminDb()
    const { data, error } = await db.rpc('get_cleanup_status')

    if (error) {
      console.error('[cleanup-status] error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    console.error('[cleanup-status] unexpected:', err)
    return apiError(err)
  }
}
