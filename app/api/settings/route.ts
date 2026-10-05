import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = await supabaseServer()

  const { data, error } = await db
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? {})
}

export async function PATCH(request: Request) {
  const db = await supabaseServer()

  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401 }
    )
  }

  const body = await request.json()

  const allowed = [
    'cafe_name',
    'tagline',
    'hero_title',
    'hero_subtitle',
    'footer_text',
    'address',
    'phone',
    'instagram',
    'working_hours',
  ]

  const updates: Record<string, string> = {}
  for (const key of allowed) {
    if (typeof body[key] === 'string') {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'no valid fields' },
      { status: 400 }
    )
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await db
    .from('settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}