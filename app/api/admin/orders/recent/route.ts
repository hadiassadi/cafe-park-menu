import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
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

    const { data, error } = await db
      .from('orders')
      .select(
        `id, order_number, created_at, customer_name, customer_phone, table_number,
         source, status, payment_status, subtotal, manual_discount,
         coupon_code, coupon_discount, is_test, items`
      )
      .gte('created_at', dayStartTehran)
      .order('order_number', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[admin orders recent]', error)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }

    return NextResponse.json(
      { orders: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin orders recent] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
