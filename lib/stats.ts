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