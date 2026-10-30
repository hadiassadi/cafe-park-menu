import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'درخواست نامعتبر است' },
        { status: 400 }
      )
    }

    const { enabled, days_kept } = (body ?? {}) as {
      enabled?: unknown
      days_kept?: unknown
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'مقدار فعال‌سازی نامعتبر است' },
        { status: 400 }
      )
    }

    const daysKept = Number(days_kept)
    if (!Number.isInteger(daysKept) || daysKept < 7 || daysKept > 365) {
      return NextResponse.json(
        { error: 'بازه نگهداری باید یک عدد صحیح بین ۷ تا ۳۶۵ روز باشد' },
        { status: 400 }
      )
    }

    const db = createAdminDb()
    const { data, error } = await db.rpc('update_cleanup_settings', {
      p_enabled: enabled,
      p_days: daysKept,
    })

    if (error) {
      console.error('[cleanup-settings] error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[cleanup-settings] unexpected:', err)
    return apiError(err)
  }
}
