import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const body = await request.json()
    const enabled = Boolean(body.enabled)
    const daysKept = Number(body.days_kept) || 90

    // اعتبارسنجی
    if (daysKept < 7 || daysKept > 365) {
      return NextResponse.json(
        { error: 'بازه نگهداری باید بین ۷ تا ۳۶۵ روز باشه' },
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