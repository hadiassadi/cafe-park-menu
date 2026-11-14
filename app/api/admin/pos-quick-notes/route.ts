import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-هـ-د: پیام‌های آمادهٔ POS — یکبار تعریف، روی هر ردیف فاکتور (کافه و غذا).
// ذخیره در ستون jsonb «pos_quick_notes» جدول settings (نیاز به SQL پچ ۵۰-هـ-د دارد).
// GET  → { notes: string[] }
// PUT  → { note: string } افزودن  |  { remove: string } حذف  → { notes: string[] }

const MAX_NOTES = 60
const MAX_LEN = 80

type Notes = string[]

function sanitize(list: unknown): Notes {
  if (!Array.isArray(list)) return []
  return [
    ...new Set(
      list
        .filter((n): n is string => typeof n === 'string')
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && n.length <= MAX_LEN)
    ),
  ].slice(0, MAX_NOTES)
}

async function readNotes(db: ReturnType<typeof supabaseAdmin>): Promise<Notes> {
  const { data, error } = await db
    .from('settings')
    .select('pos_quick_notes')
    .eq('id', 1)
    .single()
  if (error) {
    // ستون هنوز ساخته نشده یا ردیف نیست — خالی برمی‌گردانیم، نه خطا
    console.error('[admin pos-quick-notes] read:', error.message)
    return []
  }
  return sanitize(data?.pos_quick_notes)
}

export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-quick-notes-get', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const notes = await readNotes(supabaseAdmin())
    return NextResponse.json({ notes }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[admin pos-quick-notes] GET:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-quick-notes-put', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const db = supabaseAdmin()
    const notes = await readNotes(db)

    let next: Notes
    if (typeof body?.note === 'string' && body.note.trim()) {
      const t = body.note.trim().slice(0, MAX_LEN)
      if (notes.length >= MAX_NOTES) {
        return NextResponse.json(
          { error: 'حداکثر ۶۰ پیام آماده می‌توانی داشته باشی' },
          { status: 400 }
        )
      }
      next = sanitize([...notes, t])
    } else if (typeof body?.remove === 'string' && body.remove.trim()) {
      next = notes.filter((n) => n !== body.remove.trim())
    } else {
      return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 })
    }

    const { error } = await db
      .from('settings')
      .update({ pos_quick_notes: next })
      .eq('id', 1)
    if (error) {
      console.error('[admin pos-quick-notes] write:', error.message)
      return NextResponse.json(
        { error: 'ذخیره ناموفق بود — SQL پچ ۵۰-هـ-د را اجرا کرده‌ای؟' },
        { status: 500 }
      )
    }

    return NextResponse.json({ notes: next })
  } catch (err) {
    console.error('[admin pos-quick-notes] PUT:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
