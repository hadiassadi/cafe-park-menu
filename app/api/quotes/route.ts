import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: خواندن جملات
export async function GET() {
  const db = await supabaseServer()

  const { data, error } = await db
    .from('quotes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST: اضافه کردن جمله جدید (ادمین)
export async function POST(request: Request) {
  const db = await supabaseServer()

  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'متن جمله الزامی است' }, { status: 400 })
  }

  const { data, error } = await db
    .from('quotes')
    .insert({
      text: body.text.trim(),
      author:
        typeof body.author === 'string'
          ? body.author.trim() || null
          : null,
      is_active: body.is_active !== false,
      sort_order:
        typeof body.sort_order === 'number' ? body.sort_order : 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}