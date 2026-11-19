import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۱: شیفت کاری اپراتور — باز/بستن + جمع‌های زنده و مغایرت
//  GET   → شیفت بازِ من + جمع‌های لحظه‌ای (مبنای چیپ POS و پیش‌نمایش بستن)
//  POST  → باز کردن شیفت (با تنخواه افتتاحیه)
//  PATCH → بستن شیفت (با شمارش واقعی نقدی → مغایرت خودکار)

type ShiftTotals = {
  cash: number
  card: number
  online: number
  transfer: number
  orders_count: number
}

const MAX_FLOAT = 500_000_000

async function shiftTotals(
  db: ReturnType<typeof supabaseAdmin>,
  shiftId: string
): Promise<ShiftTotals> {
  const [pays, ords] = await Promise.all([
    db
      .from('order_payments')
      .select('method, amount')
      .eq('shift_id', shiftId)
      .eq('status', 'confirmed'),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', shiftId),
  ])
  const totals: ShiftTotals = {
    cash: 0,
    card: 0,
    online: 0,
    transfer: 0,
    orders_count: ords.count ?? 0,
  }
  for (const p of pays.data ?? []) {
    const a = Number(p.amount) || 0
    if (p.method === 'cash') totals.cash += a
    else if (p.method === 'card') totals.card += a
    else if (p.method === 'online') totals.online += a
    else if (p.method === 'transfer') totals.transfer += a
  }
  return totals
}

async function myOpenShift(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string
) {
  const { data } = await db
    .from('shifts')
    .select('*')
    .eq('opened_by', userId)
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .maybeSingle()
  return data
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.denied) return auth.denied

  const rl = rateLimit(req, 'admin-shifts-get', 120, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const db = supabaseAdmin()
    const cur = await myOpenShift(db, auth.userId)
    if (!cur) {
      return NextResponse.json(
        { current: null },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const totals = await shiftTotals(db, cur.id)
    return NextResponse.json(
      {
        current: {
          ...cur,
          expected_cash: Number(cur.opening_float) + totals.cash,
          totals,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin shifts] GET unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.denied) return auth.denied

  const rl = rateLimit(req, 'admin-shifts-open', 20, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body: any = await req.json().catch(() => null)
    const openingFloat = Math.floor(Number(body?.opening_float ?? 0))
    if (
      !Number.isFinite(openingFloat) ||
      openingFloat < 0 ||
      openingFloat > MAX_FLOAT
    ) {
      return NextResponse.json(
        { error: 'مبلغ تنخواه افتتاحیه نامعتبر است' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()
    const existing = await myOpenShift(db, auth.userId)
    if (existing) {
      return NextResponse.json(
        { error: 'شما یک شیفت باز دارید — اول همان را ببند' },
        { status: 409 }
      )
    }

    const { data: shift, error } = await db
      .from('shifts')
      .insert({ opened_by: auth.userId, opening_float: openingFloat })
      .select('*')
      .single()
    if (error) {
      console.error('[admin shifts] open:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ shift })
  } catch (err) {
    console.error('[admin shifts] POST unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.denied) return auth.denied

  const rl = rateLimit(req, 'admin-shifts-close', 20, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body: any = await req.json().catch(() => null)
    // شمارش واقعی نقدی — خالی یعنی بدون شمارش ببند (مغایرت ثبت نمی‌شود)
    const counted =
      body?.counted_cash === null || body?.counted_cash === undefined
        ? null
        : Math.floor(Number(body.counted_cash))
    if (
      counted !== null &&
      (!Number.isFinite(counted) || counted < 0 || counted > MAX_FLOAT)
    ) {
      return NextResponse.json(
        { error: 'مبلغ شمارش واقعی نامعتبر است' },
        { status: 400 }
      )
    }
    const note =
      typeof body?.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : null

    const db = supabaseAdmin()
    const cur = await myOpenShift(db, auth.userId)
    if (!cur) {
      return NextResponse.json(
        { error: 'شیفت بازی نداری' },
        { status: 404 }
      )
    }

    const totals = await shiftTotals(db, cur.id)
    const expectedCash = Number(cur.opening_float) + totals.cash
    const discrepancy = counted === null ? null : counted - expectedCash

    const { data: closed, error } = await db
      .from('shifts')
      .update({
        closed_at: new Date().toISOString(),
        closed_by: auth.userId,
        counted_cash: counted,
        expected_cash: expectedCash,
        discrepancy,
        closing_totals: totals,
        closing_note: note,
      })
      .eq('id', cur.id)
      .is('closed_at', null)
      .select('*')
      .single()
    if (error) {
      console.error('[admin shifts] close:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ shift: closed, totals, expected_cash: expectedCash })
  } catch (err) {
    console.error('[admin shifts] PATCH unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
