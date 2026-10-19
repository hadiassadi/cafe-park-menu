// lib/stats.ts
import 'server-only'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'

export type OrderStats = {
  today: { orders: number; revenue: number }
  week: { orders: number; revenue: number }
  month: { orders: number; revenue: number }
  topProducts: Array<{ name: string; count: number; revenue: number }>
  dailyRevenue: Array<{
    date: string
    label: string
    revenue: number
    orders: number
  }>
  monthlyRevenue: Array<{
    month: string
    label: string
    revenue: number
    orders: number
  }>
  peakHours: Array<{
    hour: number
    label: string
    orders: number
  }>
  comparison: {
    revenueChange: number
    ordersChange: number
    avgOrderChange: number
  }
  avgOrderValue: number
}

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
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

export const getOrderStats = cache(async (): Promise<OrderStats> => {
  const db = createDb()
  const now = new Date()
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

  const { data: orders, error } = await db
    .from('orders')
    .select('created_at, subtotal, status, items')
    .gte('created_at', oneYearAgo.toISOString())
    .neq('status', 'cancelled')
	.is('deleted_at', null)
    .order('created_at', { ascending: false })

  const emptyStats: OrderStats = {
    today: { orders: 0, revenue: 0 },
    week: { orders: 0, revenue: 0 },
    month: { orders: 0, revenue: 0 },
    topProducts: [],
    dailyRevenue: [],
    monthlyRevenue: [],
    peakHours: [],
    comparison: { revenueChange: 0, ordersChange: 0, avgOrderChange: 0 },
    avgOrderValue: 0,
  }

  if (error || !orders) {
    console.error('[stats] error:', error)
    return emptyStats
  }

  const todayStart = getStartOfDay(now)
  const weekStart = getStartOfWeek(now)
  const monthStart = getStartOfMonth(now)

  const prevMonthEnd = new Date(monthStart.getTime() - 1)
  const prevMonthStart = getStartOfMonth(prevMonthEnd)

  let todayOrders = 0
  let todayRevenue = 0
  let weekOrders = 0
  let weekRevenue = 0
  let monthOrders = 0
  let monthRevenue = 0
  let prevMonthOrders = 0
  let prevMonthRevenue = 0

  const productMap = new Map<string, { count: number; revenue: number }>()
  const dailyMap = new Map<string, { revenue: number; orders: number }>()
  const monthlyMap = new Map<string, { revenue: number; orders: number }>()
  const hourMap = new Map<number, number>()

  for (const order of orders) {
    const orderDate = new Date(order.created_at)
    const revenue = Number(order.subtotal) || 0

    if (orderDate >= todayStart) {
      todayOrders++
      todayRevenue += revenue
    }

    if (orderDate >= weekStart) {
      weekOrders++
      weekRevenue += revenue
    }

    if (orderDate >= monthStart) {
      monthOrders++
      monthRevenue += revenue
    } else if (orderDate >= prevMonthStart && orderDate < monthStart) {
      prevMonthOrders++
      prevMonthRevenue += revenue
    }

    if (orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) {
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
    }

    const dayKey = orderDate.toISOString().split('T')[0]
    const existingDay = dailyMap.get(dayKey) || { revenue: 0, orders: 0 }
    existingDay.revenue += revenue
    existingDay.orders++
    dailyMap.set(dayKey, existingDay)

    const monthKey = `${orderDate.getFullYear()}-${String(
      orderDate.getMonth() + 1
    ).padStart(2, '0')}`
    const existingMonth = monthlyMap.get(monthKey) || {
      revenue: 0,
      orders: 0,
    }
    existingMonth.revenue += revenue
    existingMonth.orders++
    monthlyMap.set(monthKey, existingMonth)

    if (orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) {
      const hour = orderDate.getHours()
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
    }
  }

  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const dailyRevenue: OrderStats['dailyRevenue'] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString().split('T')[0]
    const data = dailyMap.get(key) || { revenue: 0, orders: 0 }
    dailyRevenue.push({
      date: key,
      label: d.toLocaleDateString('fa-IR', { weekday: 'short', timeZone: 'Asia/Tehran' }),
      revenue: data.revenue,
      orders: data.orders,
    })
  }

  const monthlyRevenue: OrderStats['monthlyRevenue'] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}`
    const data = monthlyMap.get(key) || { revenue: 0, orders: 0 }
    monthlyRevenue.push({
      month: key,
      label: d.toLocaleDateString('fa-IR', { month: 'short', timeZone: 'Asia/Tehran' }),
      revenue: data.revenue,
      orders: data.orders,
    })
  }

  const peakHours: OrderStats['peakHours'] = []
  for (let h = 8; h <= 23; h++) {
    peakHours.push({
      hour: h,
      label: `${h}:00`,
      orders: hourMap.get(h) || 0,
    })
  }

  const revenueChange =
    prevMonthRevenue > 0
      ? Math.round(
          ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
        )
      : monthRevenue > 0
        ? 100
        : 0

  const ordersChange =
    prevMonthOrders > 0
      ? Math.round(
          ((monthOrders - prevMonthOrders) / prevMonthOrders) * 100
        )
      : monthOrders > 0
        ? 100
        : 0

  const monthAvg = monthOrders > 0 ? monthRevenue / monthOrders : 0
  const prevMonthAvg =
    prevMonthOrders > 0 ? prevMonthRevenue / prevMonthOrders : 0

  const avgOrderChange =
    prevMonthAvg > 0
      ? Math.round(((monthAvg - prevMonthAvg) / prevMonthAvg) * 100)
      : monthAvg > 0
        ? 100
        : 0

  const avgOrderValue =
    monthOrders > 0 ? Math.round(monthRevenue / monthOrders) : 0

  return {
    today: { orders: todayOrders, revenue: todayRevenue },
    week: { orders: weekOrders, revenue: weekRevenue },
    month: { orders: monthOrders, revenue: monthRevenue },
    topProducts,
    dailyRevenue,
    monthlyRevenue,
    peakHours,
    comparison: {
      revenueChange,
      ordersChange,
      avgOrderChange,
    },
    avgOrderValue,
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

    let since: Date | null = null
    if (filter === 'today') {
      since = getStartOfDay(now)
    } else if (filter === 'week') {
      since = getStartOfWeek(now)
    } else if (filter === 'month') {
      since = getStartOfMonth(now)
    }

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

    let ordersQuery = db
      .from('orders')
      .select('coupon_code, coupon_discount, subtotal, status, created_at')
      .not('coupon_code', 'is', null)
      .neq('status', 'cancelled')
	  .is('deleted_at', null)

    if (since) {
      ordersQuery = ordersQuery.gte('created_at', since.toISOString())
    }

    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('[coupon stats] orders error:', ordersError)
    }

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

    stats.sort((a, b) => b.total_discount - a.total_discount)

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

// ─── آمار مشتریان (CRM) ───

export type CustomerData = {
  phone: string
  name: string
  order_count: number
  total_spent: number
  cancelled_count: number
  last_order_at: string | null
  first_order_at: string | null
  notes: string | null
  tags: string[]
}

export type CustomersReport = {
  customers: CustomerData[]
  summary: {
    total: number
    loyal: number
    new: number
    inactive: number
    problematic: number
  }
}

export const getCustomersData = cache(async (): Promise<CustomersReport> => {
  const db = createDb()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const { data: orders, error: ordersError } = await db
    .from('orders')
    .select('customer_phone, customer_name, subtotal, status, created_at')
	.is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (ordersError || !orders) {
    console.error('[customers stats] error:', ordersError)
    return {
      customers: [],
      summary: { total: 0, loyal: 0, new: 0, inactive: 0, problematic: 0 },
    }
  }

  const { data: metaCustomers, error: metaError } = await db
    .from('customers')
    .select('phone, notes, tags')

  if (metaError) {
    console.error('[customers meta] error:', metaError)
  }

  const metaMap = new Map<string, { notes: string | null; tags: string[] }>()
  for (const c of metaCustomers ?? []) {
    const phone = c.phone
    if (!phone) continue
    const normalized = String(phone).replace(/[^\d]/g, '')
    metaMap.set(normalized, {
      notes: c.notes || null,
      tags: Array.isArray(c.tags) ? c.tags : [],
    })
  }

  const customerMap = new Map<
    string,
    {
      phone: string
      name: string
      order_count: number
      total_spent: number
      cancelled_count: number
      first_order_at: string | null
      last_order_at: string | null
    }
  >()

  for (const order of orders) {
    const phone = String(order.customer_phone || '').replace(/[^\d]/g, '')
    if (!phone) continue

    const existing = customerMap.get(phone) ?? {
      phone,
      name: order.customer_name || 'بدون نام',
      order_count: 0,
      total_spent: 0,
      cancelled_count: 0,
      first_order_at: order.created_at,
      last_order_at: order.created_at,
    }

    if (order.customer_name) existing.name = order.customer_name

    if (order.status !== 'cancelled') {
      existing.order_count++
      existing.total_spent += Number(order.subtotal) || 0
    } else {
      existing.cancelled_count++
    }

    if (!existing.first_order_at || order.created_at < existing.first_order_at) {
      existing.first_order_at = order.created_at
    }
    if (!existing.last_order_at || order.created_at > existing.last_order_at) {
      existing.last_order_at = order.created_at
    }

    customerMap.set(phone, existing)
  }

  const customers: CustomerData[] = Array.from(customerMap.values()).map(
    (c) => {
      const meta = metaMap.get(c.phone) ?? { notes: null, tags: [] }
      return {
        ...c,
        notes: meta.notes,
        tags: meta.tags,
      }
    }
  )

  customers.sort((a, b) => {
    const aTime = a.last_order_at ? new Date(a.last_order_at).getTime() : 0
    const bTime = b.last_order_at ? new Date(b.last_order_at).getTime() : 0
    return bTime - aTime
  })

  const summary = {
    total: customers.length,
    loyal: customers.filter((c) => c.order_count >= 5).length,
    new: customers.filter((c) => c.order_count === 1).length,
    inactive: customers.filter((c) => {
      if (!c.last_order_at) return false
      return new Date(c.last_order_at) < thirtyDaysAgo
    }).length,
    problematic: customers.filter((c) => c.cancelled_count >= 5).length,
  }

  return { customers, summary }
})

// ─── دلایل لغو فعال ───

export type CancellationReason = {
  id: string
  label: string
  target: 'customer' | 'admin' | 'both'
  icon: string | null
  sort_order: number
  is_active: boolean
}

export const getActiveReasons = cache(
  async (target: 'customer' | 'admin'): Promise<CancellationReason[]> => {
    const db = createDb()

    const { data, error } = await db
      .from('cancellation_reasons')
      .select('id, label, target, icon, sort_order, is_active')
      .eq('is_active', true)
      .in('target', [target, 'both'])
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[getActiveReasons] error:', error)
      return []
    }

    return data ?? []
  }
)

// ─── آمار لغو سفارش‌ها ───

export type CancellationStats = {
  summary: {
    total: number
    by_customer: number
    by_admin: number
    total_orders: number
    cancel_rate: number
  }
  topReasons: Array<{
    reason: string
    icon: string | null
    count: number
    percentage: number
  }>
  dailyCancellations: Array<{
    date: string
    label: string
    count: number
  }>
  byHour: Array<{
    hour: number
    label: string
    count: number
    percentage: number
  }>
  byWeekday: Array<{
    weekday: number
    label: string
    count: number
    percentage: number
  }>
  byCategory: Array<{
    category_name: string
    category_icon: string | null
    count: number
    percentage: number
  }>
  recentCancellations: Array<{
    id: string
    order_number: number
    customer_name: string
    customer_phone: string
    table_number: number | null
    note: string | null
    items: Array<{
      product_name: string
      option_name: string | null
      unit_price: number
      quantity: number
      discount_amount?: number
    }>
    subtotal: number
    original_subtotal: number | null
    coupon_code: string | null
    coupon_discount: number | null
    cancelled_at: string | null
    cancelled_by: string | null
    cancellation_reason_label: string | null
    cancellation_note: string | null
  }>
}

type CancelTimeFilter = 'today' | 'week' | 'month' | 'all'

export const getCancellationStats = cache(
  async (filter: CancelTimeFilter = 'month'): Promise<CancellationStats> => {
    const db = createDb()
    const now = new Date()

    let since: Date | null = null
    if (filter === 'today') {
      since = getStartOfDay(now)
    } else if (filter === 'week') {
      since = getStartOfWeek(now)
    } else if (filter === 'month') {
      since = getStartOfMonth(now)
    }

    // ─── آمار کلی سفارش‌ها ───
        let totalOrdersQuery = db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
    if (since) {
      totalOrdersQuery = totalOrdersQuery.gte('created_at', since.toISOString())
    }
    const { count: totalOrders } = await totalOrdersQuery

    // ─── آمار لغوها ───
        let cancelQuery = db
      .from('orders')
      .select(
        'id, order_number, customer_name, customer_phone, table_number, note, items, subtotal, original_subtotal, coupon_code, coupon_discount, cancelled_at, cancelled_by, cancellation_reason_label, cancellation_reason_id, cancellation_note, created_at'
      )
      .eq('status', 'cancelled')
      .is('deleted_at', null)

    if (since) {
      cancelQuery = cancelQuery.gte('created_at', since.toISOString())
    }

    const { data: cancelledOrders, error } = await cancelQuery.order(
      'cancelled_at',
      { ascending: false }
    )

    if (error) {
      console.error('[cancellation stats] error:', error)
      return {
        summary: {
          total: 0,
          by_customer: 0,
          by_admin: 0,
          total_orders: totalOrders ?? 0,
          cancel_rate: 0,
        },
        topReasons: [],
        dailyCancellations: [],
        byHour: [],
        byWeekday: [],
        byCategory: [],
        recentCancellations: [],
      }
    }

    const orders = cancelledOrders ?? []

    const byCustomer = orders.filter((o) => o.cancelled_by === 'customer').length
    const byAdmin = orders.filter((o) => o.cancelled_by === 'admin').length

    const reasonMap = new Map<
      string,
      { icon: string | null; count: number; reasonId: string | null }
    >()

    for (const order of orders) {
      const reasonLabel = order.cancellation_reason_label
      if (!reasonLabel) continue

      const existing = reasonMap.get(reasonLabel) ?? {
        icon: null,
        count: 0,
        reasonId: order.cancellation_reason_id,
      }
      existing.count += 1
      reasonMap.set(reasonLabel, existing)
    }

    const reasonIds = Array.from(reasonMap.values())
      .map((r) => r.reasonId)
      .filter((id): id is string => !!id)

    if (reasonIds.length > 0) {
      const { data: reasonsData } = await db
        .from('cancellation_reasons')
        .select('id, icon')
        .in('id', reasonIds)

      const iconMap = new Map(
        (reasonsData ?? []).map((r) => [r.id, r.icon])
      )

      for (const [label, data] of reasonMap.entries()) {
        if (data.reasonId) {
          data.icon = iconMap.get(data.reasonId) || null
        }
      }
    }

    const totalWithReason = Array.from(reasonMap.values()).reduce(
      (sum, r) => sum + r.count,
      0
    )

    const topReasons = Array.from(reasonMap.entries())
      .map(([reason, data]) => ({
        reason,
        icon: data.icon,
        count: data.count,
        percentage:
          totalWithReason > 0
            ? Math.round((data.count / totalWithReason) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const dailyMap = new Map<string, number>()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    for (const order of orders) {
      const dateStr = order.cancelled_at || order.created_at
      const d = new Date(dateStr)
      if (d < sevenDaysAgo) continue
      const key = d.toISOString().split('T')[0]
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1)
    }

    const dailyCancellations: CancellationStats['dailyCancellations'] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const key = d.toISOString().split('T')[0]
      dailyCancellations.push({
        date: key,
        label: d.toLocaleDateString('fa-IR', { weekday: 'short', timeZone: 'Asia/Tehran' }),
        count: dailyMap.get(key) || 0,
      })
    }

    const hourMap = new Map<number, number>()
    for (const order of orders) {
      const dateStr = order.cancelled_at || order.created_at
      if (!dateStr) continue
      const hour = new Date(dateStr).getHours()
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
    }

    const totalForDistribution = orders.length
    const byHour: CancellationStats['byHour'] = []
    for (let h = 8; h <= 23; h++) {
      const count = hourMap.get(h) || 0
      byHour.push({
        hour: h,
        label: `${h}:00`,
        count,
        percentage:
          totalForDistribution > 0
            ? Math.round((count / totalForDistribution) * 100)
            : 0,
      })
    }

    const PERSIAN_WEEKDAYS = [
      'شنبه',
      'یکشنبه',
      'دوشنبه',
      'سه‌شنبه',
      'چهارشنبه',
      'پنجشنبه',
      'جمعه',
    ]
    const weekdayMap = new Map<number, number>()
    for (const order of orders) {
      const dateStr = order.cancelled_at || order.created_at
      if (!dateStr) continue
      const jsDay = new Date(dateStr).getDay()
      const persianDay = (jsDay + 1) % 7
      weekdayMap.set(persianDay, (weekdayMap.get(persianDay) || 0) + 1)
    }

    const byWeekday: CancellationStats['byWeekday'] = []
    for (let d = 0; d < 7; d++) {
      const count = weekdayMap.get(d) || 0
      byWeekday.push({
        weekday: d,
        label: PERSIAN_WEEKDAYS[d],
        count,
        percentage:
          totalForDistribution > 0
            ? Math.round((count / totalForDistribution) * 100)
            : 0,
      })
    }

    const [productsResult, categoriesResult] = await Promise.all([
      db.from('products').select('name, category_id'),
      db.from('categories').select('id, name, icon'),
    ])

    const productToCategoryId = new Map<string, string>()
    for (const p of productsResult.data ?? []) {
      if (p.category_id && p.name) {
        productToCategoryId.set(p.name, p.category_id)
      }
    }

    const categoryInfoMap = new Map<
      string,
      { name: string; icon: string | null }
    >()
    for (const c of categoriesResult.data ?? []) {
      categoryInfoMap.set(c.id, { name: c.name, icon: c.icon ?? null })
    }

    const categoryCountMap = new Map<
      string,
      { count: number; icon: string | null }
    >()
    let totalCategoryItems = 0

    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : []
      for (const item of items) {
        const productName = item?.product_name || ''
        const quantity = Number(item?.quantity) || 0
        if (!quantity) continue

        const catId = productToCategoryId.get(productName)
        if (!catId) continue

        const catInfo = categoryInfoMap.get(catId)
        if (!catInfo) continue

        const existing = categoryCountMap.get(catInfo.name) ?? {
          count: 0,
          icon: catInfo.icon,
        }
        existing.count += quantity
        categoryCountMap.set(catInfo.name, existing)
        totalCategoryItems += quantity
      }
    }

    const byCategory: CancellationStats['byCategory'] = Array.from(
      categoryCountMap.entries()
    )
      .map(([name, data]) => ({
        category_name: name,
        category_icon: data.icon,
        count: data.count,
        percentage:
          totalCategoryItems > 0
            ? Math.round((data.count / totalCategoryItems) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    const recentCancellations = orders.slice(0, 20).map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      table_number: o.table_number ?? null,
      note: o.note ?? null,
      items: Array.isArray(o.items) ? o.items : [],
      subtotal: Number(o.subtotal) || 0,
      original_subtotal: o.original_subtotal ?? null,
      coupon_code: o.coupon_code ?? null,
      coupon_discount: o.coupon_discount ?? null,
      cancelled_at: o.cancelled_at,
      cancelled_by: o.cancelled_by,
      cancellation_reason_label: o.cancellation_reason_label,
      cancellation_note: o.cancellation_note,
    }))

    const cancelRate =
      (totalOrders ?? 0) > 0
        ? Math.round((orders.length / (totalOrders ?? 1)) * 100)
        : 0

    return {
      summary: {
        total: orders.length,
        by_customer: byCustomer,
        by_admin: byAdmin,
        total_orders: totalOrders ?? 0,
        cancel_rate: cancelRate,
      },
      topReasons,
      dailyCancellations,
      byHour,
      byWeekday,
      byCategory,
      recentCancellations,
    }
  }
)

// ─── گزارش فروش (برای مالیات و حسابداری) ───

export type SalesReportFilter =
  | 'today'
  | 'week'
  | 'month'
  | 'last_month'
  | 'quarter'
  | 'all'

export type SalesReportData = {
  summary: {
    total_revenue: number
    total_orders: number
    total_discount: number
    avg_order_value: number
    cancelled_count: number
    cancelled_amount: number
    period_label: string
  }
  daily: Array<{
    date: string
    label: string
    orders: number
    revenue: number
    discount: number
    net: number
    avg: number
  }>
  products: Array<{
    product_name: string
    quantity: number
    revenue: number
    percentage: number
  }>
  categories: Array<{
    category_name: string
    category_icon: string | null
    quantity: number
    revenue: number
    percentage: number
  }>
}

function getFilterRange(filter: SalesReportFilter): {
  since: Date | null
  until: Date | null
  label: string
} {
  const now = new Date()

  if (filter === 'today') {
    return {
      since: getStartOfDay(now),
      until: null,
      label: 'امروز',
    }
  }
  if (filter === 'week') {
    return {
      since: getStartOfWeek(now),
      until: null,
      label: 'این هفته',
    }
  }
  if (filter === 'month') {
    return {
      since: getStartOfMonth(now),
      until: null,
      label: 'این ماه',
    }
  }
  if (filter === 'last_month') {
    const firstOfThisMonth = getStartOfMonth(now)
    const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 1)
    const lastMonthStart = getStartOfMonth(lastMonthEnd)
    return {
      since: lastMonthStart,
      until: firstOfThisMonth,
      label: lastMonthEnd.toLocaleDateString('fa-IR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Tehran',
      }),
    }
  }
  if (filter === 'quarter') {
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    threeMonthsAgo.setHours(0, 0, 0, 0)
    return {
      since: threeMonthsAgo,
      until: null,
      label: '۳ ماه اخیر',
    }
  }
  return { since: null, until: null, label: 'همه' }
}

export const getSalesReport = cache(
  async (filter: SalesReportFilter = 'month'): Promise<SalesReportData> => {
    const db = createDb()
    const { since, until, label } = getFilterRange(filter)

    let summaryQuery = db
      .from('orders')
      .select('subtotal, original_subtotal, coupon_discount, status, created_at, items')
      .is('deleted_at', null)

    if (since) {
      summaryQuery = summaryQuery.gte('created_at', since.toISOString())
    }
    if (until) {
      summaryQuery = summaryQuery.lt('created_at', until.toISOString())
    }

    const { data: allOrders, error: summaryError } = await summaryQuery

    if (summaryError || !allOrders) {
      console.error('[sales report] summary error:', summaryError)
      return {
        summary: {
          total_revenue: 0,
          total_orders: 0,
          total_discount: 0,
          avg_order_value: 0,
          cancelled_count: 0,
          cancelled_amount: 0,
          period_label: label,
        },
        daily: [],
        products: [],
        categories: [],
      }
    }

    const validOrders = allOrders.filter((o) => o.status !== 'cancelled')
    const cancelled = allOrders.filter((o) => o.status === 'cancelled')

    const totalRevenue = validOrders.reduce(
      (sum, o) => sum + (Number(o.subtotal) || 0),
      0
    )
    const totalDiscount = validOrders.reduce(
      (sum, o) => sum + (Number(o.coupon_discount) || 0),
      0
    )
    const cancelledAmount = cancelled.reduce(
      (sum, o) => sum + (Number(o.subtotal) || 0),
      0
    )

    const dayMap = new Map<
      string,
      { orders: number; revenue: number; discount: number }
    >()

    for (const order of validOrders) {
      const date = new Date(order.created_at)
      const key = date.toISOString().split('T')[0]
      const existing = dayMap.get(key) ?? {
        orders: 0,
        revenue: 0,
        discount: 0,
      }
      existing.orders += 1
      existing.revenue += Number(order.subtotal) || 0
      existing.discount += Number(order.coupon_discount) || 0
      dayMap.set(key, existing)
    }

    const daily = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        label: new Date(date).toLocaleDateString('fa-IR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Asia/Tehran',
        }),
        orders: data.orders,
        revenue: data.revenue,
        discount: data.discount,
        net: data.revenue,
        avg: data.orders > 0 ? Math.round(data.revenue / data.orders) : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    const productMap = new Map<string, { quantity: number; revenue: number }>()
    let totalQty = 0

    for (const order of validOrders) {
      const items = Array.isArray(order.items) ? order.items : []
      for (const item of items) {
        const name = item?.product_name || 'نامشخص'
        const qty = Number(item?.quantity) || 0
        const price = Number(item?.unit_price) || 0
        if (!qty) continue
        const existing = productMap.get(name) ?? { quantity: 0, revenue: 0 }
        existing.quantity += qty
        existing.revenue += price * qty
        productMap.set(name, existing)
        totalQty += qty
      }
    }

    const products = Array.from(productMap.entries())
      .map(([name, data]) => ({
        product_name: name,
        quantity: data.quantity,
        revenue: data.revenue,
        percentage:
          totalQty > 0 ? Math.round((data.quantity / totalQty) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const [productsResult, categoriesResult] = await Promise.all([
      db.from('products').select('name, category_id'),
      db.from('categories').select('id, name, icon'),
    ])

    const productToCatMap = new Map<string, string>()
    for (const p of productsResult.data ?? []) {
      if (p.category_id && p.name) {
        productToCatMap.set(p.name, p.category_id)
      }
    }

    const catInfoMap = new Map<string, { name: string; icon: string | null }>()
    for (const c of categoriesResult.data ?? []) {
      catInfoMap.set(c.id, { name: c.name, icon: c.icon ?? null })
    }

    const catCountMap = new Map<
      string,
      { quantity: number; revenue: number; icon: string | null }
    >()
    let totalCatQty = 0

    for (const [name, data] of productMap.entries()) {
      const catId = productToCatMap.get(name)
      if (!catId) continue
      const catInfo = catInfoMap.get(catId)
      if (!catInfo) continue

      const existing = catCountMap.get(catInfo.name) ?? {
        quantity: 0,
        revenue: 0,
        icon: catInfo.icon,
      }
      existing.quantity += data.quantity
      existing.revenue += data.revenue
      catCountMap.set(catInfo.name, existing)
      totalCatQty += data.quantity
    }

    const categories = Array.from(catCountMap.entries())
      .map(([name, data]) => ({
        category_name: name,
        category_icon: data.icon,
        quantity: data.quantity,
        revenue: data.revenue,
        percentage:
          totalCatQty > 0 ? Math.round((data.quantity / totalCatQty) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      summary: {
        total_revenue: totalRevenue,
        total_orders: validOrders.length,
        total_discount: totalDiscount,
        avg_order_value:
          validOrders.length > 0
            ? Math.round(totalRevenue / validOrders.length)
            : 0,
        cancelled_count: cancelled.length,
        cancelled_amount: cancelledAmount,
        period_label: label,
      },
      daily,
      products,
      categories,
    }
  }
)