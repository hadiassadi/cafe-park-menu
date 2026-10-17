import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const db = createAdminDb()
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // خواندن همه سفارش‌ها
    const { data: orders, error: ordersError } = await db
      .from('orders')
      .select('customer_phone, customer_name, subtotal, status, created_at')
      .order('created_at', { ascending: false })

    if (ordersError || !orders) {
      return NextResponse.json({ error: ordersError?.message || 'خطا در خواندن سفارش‌ها' }, { status: 500 })
    }

    // خواندن متادیتای مشتریان (یادداشت و تگ)
    const { data: metaCustomers } = await db
      .from('customers')
      .select('phone, notes, tags')

    const metaMap = new Map<string, { notes: string | null; tags: string[] }>()
    for (const c of metaCustomers ?? []) {
      if (!c.phone) continue
      const normalized = String(c.phone).replace(/[^\d]/g, '')
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

    const customers = Array.from(customerMap.values()).map((c) => {
      const meta = metaMap.get(c.phone) ?? { notes: null, tags: [] }
      return { ...c, notes: meta.notes, tags: meta.tags }
    })

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

    return NextResponse.json({ customers, summary }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطای غیرمنتظره' }, { status: 500 })
  }
}