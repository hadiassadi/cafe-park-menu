// lib/stats.ts
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'

export type OrderStats = {
  today: { orders: number; revenue: number }
  week: { orders: number; revenue: number }
  month: { orders: number; revenue: number }
  topProducts: Array<{ name: string; count: number; revenue: number }>
  dailyRevenue: Array<{ date: string; label: string; revenue: number; orders: number }>
}

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are missing')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfWeek(date: Date): Date {
  // شنبه شروع هفته در ایران
  const d = new Date(date)
  const dayOfWeek = d.getDay() // 0=Sunday, 6=Saturday
  // شنبه = 6 در getDay
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

export const getOrderStats = cache(async (): Promise<OrderStats> => {
  const db = createDb()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const { data: orders, error } = await db
    .from('orders')
    .select('created_at, subtotal, status, items')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  const emptyStats: OrderStats = {
    today: { orders: 0, revenue: 0 },
    week: { orders: 0, revenue: 0 },
    month: { orders: 0, revenue: 0 },
    topProducts: [],
    dailyRevenue: [],
  }

  if (error || !orders) {
    console.error('[stats] error:', error)
    return emptyStats
  }

  const todayStart = getStartOfDay(now)
  const weekStart = getStartOfWeek(now)
  const monthStart = getStartOfMonth(now)

  let todayOrders = 0
  let todayRevenue = 0
  let weekOrders = 0
  let weekRevenue = 0
  let monthOrders = 0
  let monthRevenue = 0

  const productMap = new Map<string, { count: number; revenue: number }>()
  const dailyMap = new Map<string, { revenue: number; orders: number }>()

  for (const order of orders) {
    const orderDate = new Date(order.created_at)
    const revenue = Number(order.subtotal) || 0

    // امروز
    if (orderDate >= todayStart) {
      todayOrders++
      todayRevenue += revenue
    }

    // این هفته
    if (orderDate >= weekStart) {
      weekOrders++
      weekRevenue += revenue
    }

    // این ماه
    if (orderDate >= monthStart) {
      monthOrders++
      monthRevenue += revenue
    }

    // پرفروش‌ترین محصولات
    const items = Array.isArray(order.items) ? order.items : []
    for (const item of items) {
      const name = item?.product_name || 'نامشخص'
      const count = Number(item?.quantity) || 0
      const price = Number(item?.unit_price) || 0
      const existing = productMap.get(name) || { count: 0, revenue: 0 }
      existing.count += count
      existing.revenue += price * count
      productMap.set(name, existing)
    }

    // فروش روزانه
    const dayKey = orderDate.toISOString().split('T')[0]
    const existingDay = dailyMap.get(dayKey) || { revenue: 0, orders: 0 }
    existingDay.revenue += revenue
    existingDay.orders++
    dailyMap.set(dayKey, existingDay)
  }

  // پرفروش‌ترین ۵ محصول
  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // فروش ۷ روز اخیر
    const dailyRevenue: OrderStats['dailyRevenue'] = []
  for (let i = 0; i <= 6; i++) {   // ← i از 0 به 6 (امروز اولین)
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString().split('T')[0]
    const data = dailyMap.get(key) || { revenue: 0, orders: 0 }
    dailyRevenue.push({
      date: key,
      label: d.toLocaleDateString('fa-IR', { weekday: 'short' }),
      revenue: data.revenue,
      orders: data.orders,
    })
  }

  return {
    today: { orders: todayOrders, revenue: todayRevenue },
    week: { orders: weekOrders, revenue: weekRevenue },
    month: { orders: monthOrders, revenue: monthRevenue },
    topProducts,
    dailyRevenue,
  }
})
// ─── آمار کوپن‌ها ───

export type CouponStats = {
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  used_count: number
  total_discount: number
  total_revenue: number
  avg_discount: number
  order_count: number
  is_active: boolean
}

export type CouponReportData = {
  stats: CouponStats[]
  summary: {
    total_orders_with_coupon: number
    total_discount_given: number
    total_revenue_with_coupon: number
    avg_discount_per_order: number
  }
}

type TimeFilter = 'today' | 'week' | 'month' | 'all'

export const getCouponStats = cache(
  async (filter: TimeFilter = 'all'): Promise<CouponReportData> => {
    const db = createDb()
    const now = new Date()

    // محاسبه بازه زمانی
    let since: Date | null = null
    if (filter === 'today') {
      since = getStartOfDay(now)
    } else if (filter === 'week') {
      since = getStartOfWeek(now)
    } else if (filter === 'month') {
      since = getStartOfMonth(now)
    }

    // ─── خواندن کوپن‌ها ───
    const { data: coupons, error: couponsError } = await db
      .from('coupons')
      .select(
        'code, description, discount_type, discount_value, used_count, is_active'
      )
      .order('used_count', { ascending: false })

    if (couponsError || !coupons) {
      console.error('[coupon stats] error:', couponsError)
      return {
        stats: [],
        summary: {
          total_orders_with_coupon: 0,
          total_discount_given: 0,
          total_revenue_with_coupon: 0,
          avg_discount_per_order: 0,
        },
      }
    }

    // ─── خواندن سفارش‌های دارای کوپن ───
    let ordersQuery = db
      .from('orders')
      .select('coupon_code, coupon_discount, subtotal, status, created_at')
      .not('coupon_code', 'is', null)
      .neq('status', 'cancelled')

    if (since) {
      ordersQuery = ordersQuery.gte('created_at', since.toISOString())
    }

    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('[coupon stats] orders error:', ordersError)
    }

    // ─── تجمیع داده‌ها ───
    const statsMap = new Map<
      string,
      {
        order_count: number
        total_discount: number
        total_revenue: number
      }
    >()

    for (const order of orders ?? []) {
      const code = order.coupon_code
      if (!code) continue

      const existing = statsMap.get(code) ?? {
        order_count: 0,
        total_discount: 0,
        total_revenue: 0,
      }

      existing.order_count += 1
      existing.total_discount += Number(order.coupon_discount) || 0
      existing.total_revenue += Number(order.subtotal) || 0

      statsMap.set(code, existing)
    }

    // ─── ساخت خروجی نهایی ───
    const stats: CouponStats[] = coupons.map((c) => {
      const agg = statsMap.get(c.code) ?? {
        order_count: 0,
        total_discount: 0,
        total_revenue: 0,
      }

      return {
        code: c.code,
        description: c.description,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        used_count: c.used_count || 0,
        total_discount: agg.total_discount,
        total_revenue: agg.total_revenue,
        avg_discount:
          agg.order_count > 0
            ? Math.round(agg.total_discount / agg.order_count)
            : 0,
        order_count: agg.order_count,
        is_active: c.is_active,
      }
    })

    // مرتب‌سازی بر اساس مبلغ تخفیف کل
    stats.sort((a, b) => b.total_discount - a.total_discount)

    // ─── خلاصه کل ───
    const totalOrdersWithCoupon = stats.reduce(
      (sum, s) => sum + s.order_count,
      0
    )
    const totalDiscountGiven = stats.reduce(
      (sum, s) => sum + s.total_discount,
      0
    )
    const totalRevenueWithCoupon = stats.reduce(
      (sum, s) => sum + s.total_revenue,
      0
    )

    return {
      stats,
      summary: {
        total_orders_with_coupon: totalOrdersWithCoupon,
        total_discount_given: totalDiscountGiven,
        total_revenue_with_coupon: totalRevenueWithCoupon,
        avg_discount_per_order:
          totalOrdersWithCoupon > 0
            ? Math.round(totalDiscountGiven / totalOrdersWithCoupon)
            : 0,
      },
    }
  }
)