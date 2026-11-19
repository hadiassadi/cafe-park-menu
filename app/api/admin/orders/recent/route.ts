import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { PostgrestError } from '@supabase/supabase-js'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-هـ-و: سفارش‌های امروز برای «لیست سفارش‌ها» در POS.
// ادمین فقطِ امروز (از ساعت ۰۰:۰۰ تهران) را می‌گیرد؛ فیلتر حضوری/آنلاین سمت کلاینت است.
// آیتم‌ها (jsonb) هم می‌آید تا «ویرایش» بدون درخواست اضافه کار کند.
// 🎯 پچ ۵۰-هـ-او: فیلتر بازهٔ تاریخ (از/تا) + صفحه‌بندی سرورسمت — پیش‌فرض
// امروز، ۱۰ سفارش در صفحه؛ پاسخ شامل total و pages.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** شروع روز تهران (ISO) برای تاریخ YYYY-MM-DD */
function tehranDayStart(day: string): string {
  return new Date(`${day}T00:00:00+03:30`).toISOString()
}

/** پایان روز تهران (انحصاری، ISO) = شروع روز بعد */
function tehranDayEnd(day: string): string {
  return new Date(
    new Date(`${day}T00:00:00+03:30`).getTime() + 24 * 3600 * 1000
  ).toISOString()
}

export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-orders-recent', 90, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const sp = req.nextUrl.searchParams

    // ── بازهٔ تاریخ (پیش‌فرض: امروز تهران) ──
    const todayTehran = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tehran',
    })
    const fromRaw = sp.get('from')
    const toRaw = sp.get('to')
    const from = fromRaw && DAY_RE.test(fromRaw) ? fromRaw : todayTehran
    const to = toRaw && DAY_RE.test(toRaw) ? toRaw : null
    const gteIso = tehranDayStart(from)
    const ltIso = to ? tehranDayEnd(to) : null

    // ── صفحه‌بندی (پیش‌فرض: صفحهٔ ۱، ۱۰ ردیف) ──
    const page = Math.max(1, Math.min(500, parseInt(sp.get('page') || '1', 10) || 1))
    const pageSize = Math.max(
      1,
      Math.min(50, parseInt(sp.get('pageSize') || '10', 10) || 10)
    )
    const rangeFrom = (page - 1) * pageSize
    const rangeTo = rangeFrom + pageSize - 1

    const db = supabaseAdmin()

    // تعداد کل با همین فیلتر — برای شمارهٔ صفحات
    let countQuery = db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', gteIso)
    if (ltIso) countQuery = countQuery.lt('created_at', ltIso)
    const { count: total, error: countErr } = await countQuery
    if (countErr) {
      console.error('[admin orders recent] count:', countErr.message)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }

    // 🐛 فیکس ۵۰-هـ-خ: ستون paid_amount روی orders وجود ندارد (منبع پرداخت‌ها
    // جدول order_payments است) — سه‌لایه: کامل + پرداخت‌ها → کامل → مینیمال
    const FULL_COLS = `id, order_number, created_at, customer_name, customer_phone, table_number,
       source, device_id_hash, customer_confirmed, status, payment_status, payment_method, subtotal, manual_discount,
       coupon_code, coupon_discount, is_test, items`
    const LEGACY_COLS = `id, order_number, created_at, customer_name, customer_phone, table_number,
       source, status, payment_status, subtotal, coupon_code, coupon_discount, is_test, items`
    const EMBED = ', order_payments(method, amount, status)'

    const baseQuery = (cols: string, withEmbed: boolean) => {
      let q = db
        .from('orders')
        .select(withEmbed ? cols + EMBED : cols)
        .gte('created_at', gteIso)
      if (ltIso) q = q.lt('created_at', ltIso)
      return q
        .order('order_number', { ascending: false })
        .range(rangeFrom, rangeTo)
    }

    let rows: Array<Record<string, any>> | null = null
    let dbError: PostgrestError | null = null

    const first = await baseQuery(FULL_COLS, true)
    rows = (first.data as Array<Record<string, any>> | null) ?? null
    dbError = first.error

    if (dbError) {
      console.error('[admin orders recent] embed failed:', dbError.message)
      const second = await baseQuery(FULL_COLS, false)
      rows = (second.data as Array<Record<string, any>> | null) ?? null
      dbError = second.error

      // پرداخت‌ها را جداگانه می‌خوانیم و merge می‌کنیم — تسویه از دست نرود
      if (!dbError && (rows ?? []).length > 0) {
        const ids = (rows ?? []).map((r) => String(r.id))
        const pays = await db
          .from('order_payments')
          .select('order_id, method, amount, status')
          .in('order_id', ids)
        if (!pays.error) {
          const byOrder: Record<string, Array<Record<string, any>>> = {}
          for (const p of pays.data ?? []) {
            const key = String((p as any).order_id)
            ;(byOrder[key] ??= []).push({
              method: (p as any).method,
              amount: (p as any).amount,
              status: (p as any).status,
            })
          }
          rows = (rows ?? []).map((r) => ({
            ...r,
            order_payments: byOrder[String(r.id)] ?? [],
          }))
        } else {
          console.error('[admin orders recent] payments merge:', pays.error.message)
        }
      }
    }

    if (dbError) {
      console.error('[admin orders recent] full cols failed:', dbError.message)
      const third = await baseQuery(LEGACY_COLS, true)
      rows = (third.data as Array<Record<string, any>> | null) ?? null
      dbError = third.error
    }

    if (dbError) {
      console.error('[admin orders recent]', dbError)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }

    const safeTotal = total ?? (rows?.length ?? 0)
    return NextResponse.json(
      {
        orders: rows ?? [],
        total: safeTotal,
        page,
        pageSize,
        pages: Math.max(1, Math.ceil(safeTotal / pageSize)),
        from,
        to: to ?? todayTehran,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin orders recent] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
