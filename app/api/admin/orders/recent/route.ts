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

    const BASE_COLS = `id, order_number, created_at, customer_name, customer_phone, table_number,
       source, status, payment_status, payment_method, subtotal, manual_discount,
       coupon_code, coupon_discount, paid_amount, is_test, items`

    let rows: Array<Record<string, any>> | null = null
    let dbError: PostgrestError | null = null

    const first = await db
      .from('orders')
      .select(`${BASE_COLS}, order_payments(method, amount, status)`)
      .gte('created_at', dayStartTehran)
      .order('order_number', { ascending: false })
      .limit(200)
    rows = (first.data as Array<Record<string, any>> | null) ?? null
    dbError = first.error

    // 🐛 فیکس ۵۰-هـ-ح: اگر embed پرداخت‌ها شکست خورد (مثلاً FK موجود نباشد)،
    // لیست سفارش‌ها نباید بمیرد — بدون آن دوباره می‌خوانیم
    if (dbError) {
      console.error('[admin orders recent] with embed failed:', dbError.message)
      const retry = await db
        .from('orders')
        .select(BASE_COLS)
        .gte('created_at', dayStartTehran)
        .order('order_number', { ascending: false })
        .limit(200)
      rows = (retry.data as Array<Record<string, any>> | null) ?? null
      dbError = retry.error
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
