// lib/stats.ts
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
  // ✅ آمار پیشرفته
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
    revenueChange: number   // درصد تغییر نسبت به ماه قبل
    ordersChange: number
    avgOrderChange: number
  }
  avgOrderValue: number
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

  // محاسبه ماه قبل
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
    } else if (orderDate >= prevMonthStart && orderDate < monthStart) {
      // ماه قبل
      prevMonthOrders++
      prevMonthRevenue += revenue
    }

    // پرفروش‌ترین محصولات (فقط ۳۰ روز اخیر)
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

    // فروش روزانه (۷ روز اخیر)
    const dayKey = orderDate.toISOString().split('T')[0]
    const existingDay = dailyMap.get(dayKey) || { revenue: 0, orders: 0 }
    existingDay.revenue += revenue
    existingDay.orders++
    dailyMap.set(dayKey, existingDay)

    // فروش ماهانه (۶ ماه اخیر)
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

    // ساعات پرترافیک (فقط ۳۰ روز اخیر)
    if (orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) {
      const hour = orderDate.getHours()
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
    }
  }

  // پرفروش‌ترین ۵ محصول
  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // فروش ۷ روز اخیر
  const dailyRevenue: OrderStats['dailyRevenue'] = []
  for (let i = 6; i >= 0; i--) {
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

  // فروش ۶ ماه اخیر
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
      label: d.toLocaleDateString('fa-IR', { month: 'short' }),
      revenue: data.revenue,
      orders: data.orders,
    })
  }

  // ساعات پرترافیک
  const peakHours: OrderStats['peakHours'] = []
  for (let h = 8; h <= 23; h++) {
    // ساعات کاری کافه
    peakHours.push({
      hour: h,
      label: `${h}:00`,
      orders: hourMap.get(h) || 0,
    })
  }

  // محاسبه درصد تغییرات
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

  const avgOrderValue = monthOrders > 0 ? Math.round(monthRevenue / monthOrders) : 0

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
    loyal: number       // ۵+ سفارش
    new: number         // ۱ سفارش
    inactive: number    // ۳۰+ روز غیرفعال
    problematic: number // ۲+ لغو
  }
}

export const getCustomersData = cache(async (): Promise<CustomersReport> => {
  const db = createDb()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // خواندن همه سفارش‌ها (برای محاسبه آمار)
  const { data: orders, error: ordersError } = await db
    .from('orders')
    .select('customer_phone, customer_name, subtotal, status, created_at')
    .order('created_at', { ascending: false })

  if (ordersError || !orders) {
    console.error('[customers stats] error:', ordersError)
    return {
      customers: [],
      summary: { total: 0, loyal: 0, new: 0, inactive: 0, problematic: 0 },
    }
  }

  // خواندن یادداشت‌ها و تگ‌ها
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

  // تجمیع داده‌های هر مشتری
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

    // آپدیت نام (آخرین نام)
    if (order.customer_name) existing.name = order.customer_name

    if (order.status !== 'cancelled') {
      existing.order_count++
      existing.total_spent += Number(order.subtotal) || 0
    } else {
      existing.cancelled_count++
    }

    // آپدیت تاریخ‌ها
    if (!existing.first_order_at || order.created_at < existing.first_order_at) {
      existing.first_order_at = order.created_at
    }
    if (!existing.last_order_at || order.created_at > existing.last_order_at) {
      existing.last_order_at = order.created_at
    }

    customerMap.set(phone, existing)
  }

  // تبدیل به آرایه و اضافه کردن متادیتا
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

  // مرتب‌سازی بر اساس آخرین سفارش
  customers.sort((a, b) => {
    const aTime = a.last_order_at ? new Date(a.last_order_at).getTime() : 0
    const bTime = b.last_order_at ? new Date(b.last_order_at).getTime() : 0
    return bTime - aTime
  })

  // محاسبه summary
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
    cancel_rate: number  // درصد
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
    let totalOrdersQuery = db.from('orders').select('*', { count: 'exact', head: true })
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
        recentCancellations: [],
      }
    }

    const orders = cancelledOrders ?? []

    // ─── محاسبه آمار ───
    const byCustomer = orders.filter((o) => o.cancelled_by === 'customer').length
    const byAdmin = orders.filter((o) => o.cancelled_by === 'admin').length

    // ─── دلایل پرتکرار ───
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

    // ─── گرفتن آیکون دلایل ───
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

    // ─── لغوها به تفکیک روز (۷ روز اخیر) ───
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
        label: d.toLocaleDateString('fa-IR', { weekday: 'short' }),
        count: dailyMap.get(key) || 0,
      })
    }

        // ─── ۲۰ لغو اخیر ───
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
      recentCancellations,
    }
  }
)