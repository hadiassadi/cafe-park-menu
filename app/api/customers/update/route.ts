import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

const CREDIT_VALUES = ['default', 'allow', 'block']

export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const body = await req.json()
    const { phone, notes, tags, credit_override, phone_verified } = body

    if (!phone) {
      return NextResponse.json({ error: 'شماره تلفن الزامی است' }, { status: 400 })
    }

    const cleanPhone = String(phone).replace(/[^\d]/g, '')
    if (!/^09\d{9}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { phone: cleanPhone, updated_at: now }

    if (notes !== undefined) {
      patch.notes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 2000) : null
    }
    if (tags !== undefined) {
      patch.tags = Array.isArray(tags)
        ? tags.filter((t: unknown) => typeof t === 'string').slice(0, 30)
        : []
    }
    if (credit_override !== undefined) {
      if (!CREDIT_VALUES.includes(credit_override)) {
        return NextResponse.json({ error: 'مقدار وضعیت اعتبار نامعتبر است' }, { status: 400 })
      }
      patch.credit_override = credit_override
    }
    if (phone_verified !== undefined) {
      patch.phone_verified_at = phone_verified === true ? now : null
    }

    const db = createAdminDb()
    const { error } = await db.from('customers').upsert(patch, { onConflict: 'phone' })

    if (error) {
      console.error('[customers/update]', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return apiError(err)
  }
}
