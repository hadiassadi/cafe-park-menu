// lib/dashboard-stats.ts
// 🎯 پچ ۷۱ — آمارِ سبک و بخش‌بخش‌شدهٔ داشبورد
//   مشکل: getOrderStats قدیمی در یک فراخوانی ۶ ماه سفارش + آیتم‌های jsonb
//   ۳۰ روزه را می‌کشید و لود اولیهٔ داشبورد را کند می‌کرد.
//   راه‌حل: هر بخشِ داشبورد تابع مخصوص خودش را دارد:
//     getQuickStats()      → فقط ۳۵ روز اخیر: امروز/هفته/ماه (کارت‌های بالای داشبورد)
//     getOperatorStats()   → همان آمار ولی شخصیِ یک اپراتور (operator_id)
//     getChartStats()      → نمودارها (فقط وقتی تب «نمودارها» باز شود)
//     getTopProducts()     → پرفروش‌ها (فقط وقتی تب «پرفروش‌ها» باز شود)
//   هیچ فایل دیگری تغییر نمی‌کند؛ lib/stats.ts دست‌نخورده می‌ماند.
import 'server-only'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are missing')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── همان منطق مرزهای زمانی stats.ts قدیمی (سازگار با اعداد فعلی) ───
function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  const diff = dayOfWeek === 6 ? 0 : dayOfWeek + 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export type QuickStats = {
  today: { orders: number; revenue: number }
  week: { orders: number; revenue: number }
  month: { orders: number; revenue: number }
}

export type OperatorStats = QuickStats

const zeroQuick = (): QuickStats => ({
  today: { orders: 0, revenue: 0 },
  week: { orders: 0, revenue: 0 },
  month: { orders: 0, revenue: 0 },
})

// فیلترهای مشترک — همان فیلترهای stats.ts: بدون لغو، بدون حذف‌شده، بدون تست
function baseOrdersQuery(db: ReturnType<typeof createDb>) {
  return db
    .from('orders')
    .select('created_at, subtotal, operator_id')
    .neq('status', 'cancelled')
    .is('deleted_at', null)
    .eq('is_test', false)
}

// تجمیع سبک روی ردیف‌های ۳۵ روز اخیر
function aggregateQuick(
  rows: Array<{ created_at: string; subtotal: unknown }>,
  now: Date
): QuickStats {
  const todayStart = getStartOfDay(now)
  const weekStart = getStartOfWeek(now)
  const monthStart = getStartOfMonth(now)

  const out = zeroQuick()
  for (const row of rows) {
    const d = new Date(row.created_at)
    const revenue = Number(row.subtotal) || 0
    if (d >= monthStart) {
      out.month.orders++
      out.month.revenue += revenue
    }
    if (d >= weekStart) {
      out.week.orders++
      out.week.revenue += revenue
    }
    if (d >= todayStart) {
      out.today.orders++
      out.today.revenue += revenue
    }
  }
  return out
}

// ─── آمار سریع کل مجموعه (کارت‌های بالای داشبورد مالک/مدیر) ───
// 🎯 پچ ۷۱: فقط ۳۵ روز — سبک؛ نسخهٔ کاملِ شش‌ماهه فقط در تب «نمودارها» لود می‌شود
export const getQuickStats = cache(async (): Promise<QuickStats> => {
  try {
    const db = createDb()
    const now = new Date()
    const since = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
    const { data, error } = await baseOrdersQuery(db)
      .gte('created_at', since.toISOString())
    if (error || !data) {
      console.error('[dashboard-stats quick] error:', error)
      return zeroQuick()
    }
    return aggregateQuick(
      data as Array<{ created_at: string; subtotal: unknown }>,
      now
    )
  } catch (err) {
    console.error('[dashboard-stats quick] unexpected:', err)
    return zeroQuick()
  }
})

// ─── 🎯 پچ ۷۱: آمار شخصیِ یک اپراتور ──
// «هر کاربر سابقهٔ فروش و گزارش‌های خودش را ببیند» — صندوق‌دار/کارمند فقط
// سفارش‌های ثبت‌شدهٔ خودش را می‌بیند (operator_id از پچ ۵۱ روی هر سفارش هست).
export const getOperatorStats = cache(
  async (operatorId: string): Promise<OperatorStats> => {
    try {
      const db = createDb()
      const now = new Date()
      const since = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
      const { data, error } = await baseOrdersQuery(db)
        .eq('operator_id', operatorId)
        .gte('created_at', since.toISOString())
      if (error || !data) {
        console.error('[dashboard-stats operator] error:', error)
        return zeroQuick()
      }
      return aggregateQuick(
        data as Array<{ created_at: string; subtotal: unknown }>,
        now
      )
    } catch (err) {
      console.error('[dashboard-stats operator] unexpected:', err)
      return zeroQuick()
    }
  }
)

// ─── دادهٔ تب «نمودارها» — فقط وقتی آن تب باز شود فراخوانی می‌شود ───
export type ChartStats = {
  month: { revenue: number; orders: number }
  avgOrderValue: number
  comparison: {
    revenueChange: number
    ordersChange: number
    avgOrderChange: number
  }
  dailyRevenue: Array<{ date: string; label: string; revenue: number; orders: number }>
  monthlyRevenue: Array<{ month: string; label: string; revenue: number; orders: number }>
  peakHours: Array<{ hour: number; label: string; orders: number }>
}

const zeroCharts = (): ChartStats => ({
  month: { revenue: 0, orders: 0 },
  avgOrderValue: 0,
  comparison: { revenueChange: 0, ordersChange: 0, avgOrderChange: 0 },
  dailyRevenue: [],
  monthlyRevenue: [],
  peakHours: [],
})

export const getChartStats = cache(async (): Promise<ChartStats> => {
  try {
    const db = createDb()
    const now = new Date()
    const sixMonthsAgo = new Date(now.getTime() - 183 * 24 * 60 * 60 * 1000)

    const { data, error } = await baseOrdersQuery(db)
      .select('created_at, subtotal')
      .gte('created_at', sixMonthsAgo.toISOString())
    if (error || !data) {
      console.error('[dashboard-stats charts] error:', error)
      return zeroCharts()
    }

    const monthStart = getStartOfMonth(now)
    const prevMonthEnd = new Date(monthStart.getTime() - 1)
    const prevMonthStart = getStartOfMonth(prevMonthEnd)

    let monthRevenue = 0
    let monthOrders = 0
    let prevMonthRevenue = 0
    let prevMonthOrders = 0

    const dailyMap = new Map<string, { revenue: number; orders: number }>()
    const monthlyMap = new Map<string, { revenue: number; orders: number }>()
    const hourMap = new Map<number, number>()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    for (const row of data) {
      const d = new Date(row.created_at)
      const revenue = Number(row.subtotal) || 0

      if (d >= monthStart) {
        monthRevenue += revenue
        monthOrders++
      } else if (d >= prevMonthStart && d < monthStart) {
        prevMonthRevenue += revenue
        prevMonthOrders++
      }

      const dayKey = d.toISOString().split('T')[0]
      const day = dailyMap.get(dayKey) || { revenue: 0, orders: 0 }
      day.revenue += revenue
      day.orders++
      dailyMap.set(dayKey, day)

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const month = monthlyMap.get(monthKey) || { revenue: 0, orders: 0 }
      month.revenue += revenue
      month.orders++
      monthlyMap.set(monthKey, month)

      if (d >= thirtyDaysAgo) {
        const hour = d.getHours()
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
      }
    }

    const dailyRevenue: ChartStats['dailyRevenue'] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const key = d.toISOString().split('T')[0]
      const v = dailyMap.get(key) || { revenue: 0, orders: 0 }
      dailyRevenue.push({
        date: key,
        label: d.toLocaleDateString('fa-IR', { weekday: 'short', timeZone: 'Asia/Tehran' }),
        revenue: v.revenue,
        orders: v.orders,
      })
    }

    const monthlyRevenue: ChartStats['monthlyRevenue'] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const v = monthlyMap.get(key) || { revenue: 0, orders: 0 }
      monthlyRevenue.push({
        month: key,
        label: d.toLocaleDateString('fa-IR', { month: 'short', timeZone: 'Asia/Tehran' }),
        revenue: v.revenue,
        orders: v.orders,
      })
    }

    const peakHours: ChartStats['peakHours'] = []
    for (let h = 8; h <= 23; h++) {
      peakHours.push({ hour: h, label: `${h}:00`, orders: hourMap.get(h) || 0 })
    }

    const pct = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0

    const monthAvg = monthOrders > 0 ? monthRevenue / monthOrders : 0
    const prevMonthAvg = prevMonthOrders > 0 ? prevMonthRevenue / prevMonthOrders : 0

    return {
      month: { revenue: monthRevenue, orders: monthOrders },
      avgOrderValue: monthOrders > 0 ? Math.round(monthRevenue / monthOrders) : 0,
      comparison: {
        revenueChange: pct(monthRevenue, prevMonthRevenue),
        ordersChange: pct(monthOrders, prevMonthOrders),
        avgOrderChange: pct(monthAvg, prevMonthAvg),
      },
      dailyRevenue,
      monthlyRevenue,
      peakHours,
    }
  } catch (err) {
    console.error('[dashboard-stats charts] unexpected:', err)
    return zeroCharts()
  }
})

// ─── دادهٔ تب «پرفروش‌ها» — فقط وقتی آن تب باز شود فراخوانی می‌شود ───
export type TopProduct = { name: string; count: number; revenue: number }

export const getTopProducts = cache(async (): Promise<TopProduct[]> => {
  try {
    const db = createDb()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { data, error } = await db
      .from('orders')
      .select('items')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .neq('status', 'cancelled')
      .is('deleted_at', null)
      .eq('is_test', false)
    if (error || !data) {
      console.error('[dashboard-stats top] error:', error)
      return []
    }

    const productMap = new Map<string, { count: number; revenue: number }>()
    for (const order of data) {
      const items = Array.isArray(order.items) ? order.items : []
      for (const item of items) {
        const name = item?.product_name || 'نام‌نخواه'
        const count = Number(item?.quantity) || 0
        const price = Number(item?.unit_price) || 0
        const existing = productMap.get(name) || { count: 0, revenue: 0 }
        existing.count += count
        existing.revenue += price * count
        productMap.set(name, existing)
      }
    }

    return Array.from(productMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  } catch (err) {
    console.error('[dashboard-stats top] unexpected:', err)
    return []
  }
})
