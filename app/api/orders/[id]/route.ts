import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase admin env variables are missing')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = createAdminDb()

    const { data, error } = await db
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { error: 'سفارش پیدا نشد' },
        { status: 404 }
      )
    }

    return NextResponse.json({ order: data }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    console.error('[api/orders/[id]] error:', err)
    return apiError(err)
  }
}