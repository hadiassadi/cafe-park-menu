import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { resolveShiftActor } from '@/lib/admin/shift-auth'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۱: شیفت کاری اپراتور — باز/بستن + جمع‌های زنده و مغایرت
// 🎯 پچ ۶۲: گردش کامل شیفت — تحویل صندوق از شیفت قبلی، ساعت کاری مجاز،
//            سفارش‌های بازِ مانده هنگام بستن، نام نمایشی لحظهٔ ثبت
// 🎯 پچ ۶۴: هویت شیفت با resolveShiftActor — هم جلسهٔ پنل و هم توکن کارمند
//            موبایل (staff-otp) مجاز است؛ منطق شیفت تغییری نکرده است.
// 🎯 پچ ۶۴ — اصلاح نوع «سرمایه»: مبلغ تنخواه/شمارش با parseAmount پارس می‌شود —
//            ارقام فارسی/عربی و جداکننده‌ها («۵۰۰٬۰۰۰» یا '500,000') معتبرند و
//            مقدار همیشه به‌صورت عدد صحیح در ستون bigint ذخیره می‌شود.
//  GET   → شیفت بازِ من + جمع‌های لحظه‌ای + شیفت قبلی (مبنای تحویل) + ساعت کاری من
//  POST  → باز کردن شیفت (تنخواه/تحویل) — خارج از ساعت کاری مجاز رد می‌شود
//  PATCH → بستن شیفت (شمارش واقعی نقدی → مغایرت خودکار)

type ShiftTotals = {
  cash: number
  card: number
  online: number
  transfer: number
  orders_count: number
}

const MAX_FLOAT = 500_000_000

// 🎯 پچ ۶۴: پارس امن مبالغ ورودی — فارسی/عربی/لاتین + هر جداکننده‌ای
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.floor(raw) : NaN
  }
  let s = String(raw ?? '').trim()
  if (!s) return NaN
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
  s = s.replace(/[,\s٬]/g, '')
  if (!/^\d+$/.test(s)) return NaN
  const n = Math.floor(Number(s))
  return Number.isFinite(n) ? n : NaN
}

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

// تعداد سفارش‌های بازِ مانده (تسویه‌نشده) — پول صندوق نیستند ولی ثبت می‌شوند
async function openOrdersCount(
  db: ReturnType<typeof supabaseAdmin>,
  shiftId: string
): Promise<number> {
  const { count } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .neq('status', 'cancelled')
    .neq('payment_status', 'paid')
  return count ?? 0
}

// نام نمایشی کاربر (متادیتا یا ایمیل) — اسنپ‌شات برای مودال تحویل
async function userName(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string
): Promise<string> {
  try {
    const { data } = await db.auth.admin.getUserById(userId)
    const u: any = data?.user
    return (
      (typeof u?.user_metadata?.full_name === 'string' &&
        u.user_metadata.full_name.trim()) ||
      u?.email ||
      'کاربر'
    )
  } catch {
    return 'کاربر'
  }
}

function nowTehranHM(): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tehran',
  }).format(new Date())
}

// بازهٔ ثابت روزانه؛ پشتیبانی از شیفت شبانه (مثلاً ۲۲:۰۰ تا ۰۶:۰۰)
function withinWindow(now: string, start: string, end: string): boolean {
  const re = /^\d{2}:\d{2}$/
  if (!re.test(start) || !re.test(end)) return true
  if (start <= end) return now >= start && now <= end
  return now >= start || now <= end
}

async function myWindow(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string
): Promise<{ start: string; end: string } | null> {
  const { data } = await db
    .from('admin_operator_profiles')
    .select('shift_start_time, shift_end_time')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.shift_start_time || !data?.shift_end_time) return null
  return { start: data.shift_start_time, end: data.shift_end_time }
}

// آخرین شیفت بسته‌شده (هر کاربری) — مبنای «تحویل صندوق» برای شیفت بعدی
async function previousClosedShift(
  db: ReturnType<typeof supabaseAdmin>
) {
  const { data } = await db
    .from('shifts')
    .select(
      'id, opened_by, opened_by_name, opened_at, closed_at, opening_float, counted_cash, expected_cash, approved_by, closing_open_orders'
    )
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const announced =
    data.counted_cash !== null && data.counted_cash !== undefined
      ? Number(data.counted_cash)
      : data.expected_cash !== null && data.expected_cash !== undefined
        ? Number(data.expected_cash)
        : Number(data.opening_float)
  return {
    id: data.id as string,
    opened_by: data.opened_by as string,
    opened_by_name: (data.opened_by_name as string) || 'کاربر',
    closed_at: data.closed_at as string,
    announced,
    approved: Boolean(data.approved_by),
    closing_open_orders:
      data.closing_open_orders === null || data.closing_open_orders === undefined
        ? null
        : Number(data.closing_open_orders),
  }
}

export async function GET(req: NextRequest) {
  const actor = await resolveShiftActor()
  if (actor.denied) return actor.denied

  const rl = rateLimit(req, 'admin-shifts-get', 120, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const db = supabaseAdmin()
    const [cur, prev, win] = await Promise.all([
      myOpenShift(db, actor.userId),
      previousClosedShift(db),
      myWindow(db, actor.userId),
    ])
    if (!cur) {
      return NextResponse.json(
        { current: null, previous: prev, window: win },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const [totals, openOrders] = await Promise.all([
      shiftTotals(db, cur.id),
      openOrdersCount(db, cur.id),
    ])
    return NextResponse.json(
      {
        current: {
          ...cur,
          expected_cash: Number(cur.opening_float) + totals.cash,
          totals,
          open_orders: openOrders,
        },
        previous: prev,
        window: win,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin shifts] GET unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const actor = await resolveShiftActor()
  if (actor.denied) return actor.denied

  const rl = rateLimit(req, 'admin-shifts-open', 20, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body: any = await req.json().catch(() => null)
    // 🎯 پچ ۶۴: مبلغ تنخواه/تحویل با parseAmount — ارقام فارسی و جداکننده OK
    const openingFloat = parseAmount(body?.opening_float ?? 0)
    if (
      !Number.isFinite(openingFloat) ||
      openingFloat < 0 ||
      openingFloat > MAX_FLOAT
    ) {
      return NextResponse.json(
        { error: 'مبلغ تنخواه/تحویل نامعتبر است' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // 🎯 پچ ۶۲: ساعت کاری مجاز — اگر مدیر برای این کاربر بازه تعریف کرده باشد
    const win = await myWindow(db, actor.userId)
    if (win && !withinWindow(nowTehranHM(), win.start, win.end)) {
      return NextResponse.json(
        {
          error: `⏱ ساعت کاری تو از ${win.start} تا ${win.end} است — باز کردن شیفت الان ممکن نیست`,
        },
        { status: 403 }
      )
    }

    const existing = await myOpenShift(db, actor.userId)
    if (existing) {
      return NextResponse.json(
        { error: 'شما یک شیفت باز دارید — اول همان را ببند' },
        { status: 409 }
      )
    }

    // 🎯 پچ ۶۲: تحویل صندوق از شیفت قبلی (اختیاری)
    const prevShiftId =
      typeof body?.previous_shift_id === 'string' && body.previous_shift_id
        ? body.previous_shift_id
        : null
    const handoverAccepted = body?.handover_accepted === true
    const handoverNote =
      typeof body?.handover_note === 'string' && body.handover_note.trim()
        ? body.handover_note.trim().slice(0, 200)
        : null
    let handover: Record<string, any> = {}
    if (prevShiftId) {
      const { data: prevRow } = await db
        .from('shifts')
        .select('id, closed_at, counted_cash, expected_cash, opening_float')
        .eq('id', prevShiftId)
        .maybeSingle()
      if (!prevRow?.closed_at) {
        return NextResponse.json(
          { error: 'شیفت مبدأ تحویل باز یا پیدا نشد' },
          { status: 400 }
        )
      }
      const announced =
        prevRow.counted_cash !== null && prevRow.counted_cash !== undefined
          ? Number(prevRow.counted_cash)
          : prevRow.expected_cash !== null && prevRow.expected_cash !== undefined
            ? Number(prevRow.expected_cash)
            : Number(prevRow.opening_float)
      handover = {
        handover_from_shift_id: prevRow.id,
        handover_expected: announced,
        handover_actual: openingFloat,
        handover_accepted: handoverAccepted,
        handover_note: handoverNote,
      }
    }

    const myName = await userName(db, actor.userId)
    const { data: shift, error } = await db
      .from('shifts')
      .insert({
        opened_by: actor.userId,
        opened_by_name: myName,
        opening_float: openingFloat,
        ...handover,
      })
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
  const actor = await resolveShiftActor()
  if (actor.denied) return actor.denied

  const rl = rateLimit(req, 'admin-shifts-close', 20, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body: any = await req.json().catch(() => null)
    // شمارش واقعی نقدی — خالی یعنی بدون شمارش ببند (مغایرت ثبت نمی‌شود)
    // 🎯 پچ ۶۴: با parseAmount — «۵۰۰٬۰۰۰» هم درست پارس می‌شود
    const counted =
      body?.counted_cash === null || body?.counted_cash === undefined
        ? null
        : parseAmount(body.counted_cash)
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
    const cur = await myOpenShift(db, actor.userId)
    if (!cur) {
      return NextResponse.json(
        { error: 'شیفت بازی نداری' },
        { status: 404 }
      )
    }

    const [totals, openOrders] = await Promise.all([
      shiftTotals(db, cur.id),
      openOrdersCount(db, cur.id),
    ])
    const expectedCash = Number(cur.opening_float) + totals.cash
    const discrepancy = counted === null ? null : counted - expectedCash

    const myName = await userName(db, actor.userId)

    // 🎯 پچ ۶۲-ب: شیفت «صاحب» بدون نیاز به تأیید — هنگام بستن خودکار تأیید می‌شود
    const { data: profRole } = await db
      .from('admin_operator_profiles')
      .select('role')
      .eq('user_id', actor.userId)
      .maybeSingle()
    const isOwner = profRole?.role === 'owner'

    const { data: closed, error } = await db
      .from('shifts')
      .update({
        closed_at: new Date().toISOString(),
        closed_by: actor.userId,
        closed_by_name: myName,
        ...(isOwner
          ? { approved_by: actor.userId, approved_at: new Date().toISOString() }
          : {}),
        counted_cash: counted,
        expected_cash: expectedCash,
        discrepancy,
        closing_totals: totals,
        closing_open_orders: openOrders,
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
    return NextResponse.json({
      shift: closed,
      totals,
      expected_cash: expectedCash,
      open_orders: openOrders,
    })
  } catch (err) {
    console.error('[admin shifts] PATCH unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
