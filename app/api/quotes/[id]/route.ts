import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH: ویرایش جمله
export async function PATCH(request: Request, { params }: Params) {
  const db = await supabaseServer()
  const { id } = await params

  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (typeof body.text === 'string' && body.text.trim()) {
    updates.text = body.text.trim()
  }
  if (typeof body.author === 'string') {
    updates.author = body.author.trim() || null
  }
  if (typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active
  }
  if (typeof body.sort_order === 'number') {
    updates.sort_order = body.sort_order
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await db
    .from('quotes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE: حذف جمله
export async function DELETE(_request: Request, { params }: Params) {
  const db = await supabaseServer()
  const { id } = await params

  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { error } = await db.from('quotes').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}