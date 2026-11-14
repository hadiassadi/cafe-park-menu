import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-هـ-ب: شمارندهٔ سبک «سفارش‌های امروز» برای نوار POS —
// فقط سفارش‌های ثبت‌شده از همین صفحه (source=admin)، بدون لغوشده و تستی.
// بازهٔ «امروز» بر اساس تقویم تهران؛ ایران از ۱۴۰۱ ساعت تابستانی ندارد → +03:30 ثابت.

const CANCELLED = new Set(['cancelled', 'canceled'])

export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-today-stats', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
    const start = new Date(`${day}T00:00:00+03:30`)
    const end = new Date(start.getTime() + 24 * 60 * 60_000)

    const { data, error } = await supabaseAdmin()
      .from('orders')
      .select('subtotal, takeaway_fee_total, status, is_test')
      .eq('source', 'admin')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    if (error) {
      console.error('[admin today-stats]:', error.message)
      return NextResponse.json({ error: 'خطا در خواندن آمار' }, { status: 500 })
    }

    let count = 0
    let revenue = 0
    for (const o of data ?? []) {
      if (o.is_test === true) continue
      if (o.status && CANCELLED.has(o.status)) continue
      count += 1
      revenue += Number(o.subtotal ?? 0) + Number(o.takeaway_fee_total ?? 0)
    }

    return NextResponse.json(
      { count, revenue },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin today-stats]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
