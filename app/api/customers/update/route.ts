import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, notes, tags } = body

    if (!phone) {
      return NextResponse.json({ error: 'شماره تلفن الزامی است' }, { status: 400 })
    }

    const cleanPhone = String(phone).replace(/[^\d]/g, '')
    const db = createAdminDb()

    // ۱. چک کن مشتری وجود داره یا نه
    const { data: existing } = await db
      .from('customers')
      .select('phone')
      .eq('phone', cleanPhone)
      .maybeSingle()

    let error;

    if (existing) {
      // آپدیت
      const { error: updateErr } = await db
        .from('customers')
        .update({ notes: notes || null, tags: tags || [], updated_at: new Date().toISOString() })
        .eq('phone', cleanPhone)
      error = updateErr
    } else {
      // درج
      const { error: insertErr } = await db
        .from('customers')
        .insert({ phone: cleanPhone, notes: notes || null, tags: tags || [], updated_at: new Date().toISOString() })
      error = insertErr
    }

    if (error) {
      console.error('[customers/update]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطای غیرمنتظره' }, { status: 500 })
  }
}