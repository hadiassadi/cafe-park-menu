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

export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-orders-recent', 90, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const db = supabaseAdmin()
    const dayStartTehran = new Date(
      `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })}T00:00:00+03:30`
    ).toISOString()

    // 🐛 فیکس ۵۰-هـ-خ: ستون paid_amount روی orders وجود ندارد (منبع پرداخت‌ها جدول
    // order_payments است) — همان ستون قبلاً «خطای پایگاه داده» می‌ساخت.
    // سه‌لایه: کامل + پرداخت‌ها → کامل → ستون‌های مینیمال همیشه‌کارا
    const FULL_COLS = `id, order_number, created_at, customer_name, customer_phone, table_number,
       source, status, payment_status, payment_method, subtotal, manual_discount,
       coupon_code, coupon_discount, is_test, items`
    const LEGACY_COLS = `id, order_number, created_at, customer_name, customer_phone, table_number,
       source, status, payment_status, subtotal, coupon_code, coupon_discount, is_test, items`

    let rows: Array<Record<string, any>> | null = null
    let dbError: PostgrestError | null = null

    const first = await db
      .from('orders')
      .select(`${FULL_COLS}, order_payments(method, amount, status)`)
      .gte('created_at', dayStartTehran)
      .order('order_number', { ascending: false })
      .limit(200)
    rows = (first.data as Array<Record<string, any>> | null) ?? null
    dbError = first.error

    if (dbError) {
      console.error('[admin orders recent] embed failed:', dbError.message)
      const second = await db
        .from('orders')
        .select(FULL_COLS)
        .gte('created_at', dayStartTehran)
        .order('order_number', { ascending: false })
        .limit(200)
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
      const third = await db
        .from('orders')
        .select(LEGACY_COLS)
        .gte('created_at', dayStartTehran)
        .order('order_number', { ascending: false })
        .limit(200)
      rows = (third.data as Array<Record<string, any>> | null) ?? null
      dbError = third.error
    }

    if (dbError) {
      console.error('[admin orders recent]', dbError)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }

    return NextResponse.json(
      { orders: rows ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin orders recent] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
