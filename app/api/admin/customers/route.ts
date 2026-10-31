import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

const normalizePhone = (v: unknown) => String(v ?? '').replace(/[^\d]/g, '')

export async function GET() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = createAdminDb()
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // خواندن همه سفارش‌ها
    const { data: orders, error: ordersError } = await db
      .from('orders')
      .select('id, customer_phone, customer_name, subtotal, status, payment_status, deleted_at, created_at')
      .order('created_at', { ascending: false })

    if (ordersError || !orders) {
      return NextResponse.json(
        { error: ordersError?.message || 'خطا در خواندن سفارش‌ها' },
        { status: 500 }
      )
    }

    // خواندن اطلاعات مشتریان (یادداشت، تگ، تأیید شماره، وضعیت اعتبار)
    const { data: metaCustomers } = await db
      .from('customers')
      .select('phone, notes, tags, phone_verified_at, credit_override')

    const metaMap = new Map<
      string,
      {
        notes: string | null
        tags: string[]
        phone_verified_at: string | null
        credit_override: string
      }
    >()
    for (const c of metaCustomers ?? []) {
      if (!c.phone) continue
      metaMap.set(normalizePhone(c.phone), {
        notes: c.notes || null,
        tags: Array.isArray(c.tags) ? c.tags : [],
        phone_verified_at: c.phone_verified_at ?? null,
        credit_override: c.credit_override || 'default',
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

    // محاسبهٔ اعتبار: سفارش تسویه‌شده و سفارش‌های باز هر مشتری
    const settledByPhone = new Map<string, number>()
    const openOrdersByPhone = new Map<string, { id: string; subtotal: number }[]>()

    for (const order of orders) {
      const phone = normalizePhone(order.customer_phone)
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

      // اعتبار: سفارش لغو یا حذف‌شده حساب نمی‌شود
      if (order.status !== 'cancelled' && order.status !== 'canceled' && !order.deleted_at) {
        if (order.status === 'delivered' && order.payment_status === 'paid') {
          settledByPhone.set(phone, (settledByPhone.get(phone) ?? 0) + 1)
        } else {
          const list = openOrdersByPhone.get(phone) ?? []
          list.push({ id: order.id, subtotal: Number(order.subtotal) || 0 })
          openOrdersByPhone.set(phone, list)
        }
      }
    }

    // پرداخت‌های تأییدشدهٔ سفارش‌های باز
    const openIds: string[] = []
    for (const list of openOrdersByPhone.values()) {
      for (const o of list) openIds.push(o.id)
    }

    const paidByOrder = new Map<string, number>()
    if (openIds.length > 0) {
      const { data: pays } = await db
        .from('order_payments')
        .select('order_id, amount')
        .in('order_id', openIds)
        .eq('status', 'confirmed')
      for (const p of pays ?? []) {
        paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount))
      }
    }

    const customers = Array.from(customerMap.values()).map((c) => {
      const meta = metaMap.get(c.phone)
      let openDebt = 0
      for (const o of openOrdersByPhone.get(c.phone) ?? []) {
        openDebt += Math.max(0, o.subtotal - (paidByOrder.get(o.id) ?? 0))
      }
      return {
        ...c,
        notes: meta?.notes ?? null,
        tags: meta?.tags ?? [],
        has_record: !!meta,
        phone_verified_at: meta?.phone_verified_at ?? null,
        credit_override: meta?.credit_override ?? 'default',
        settled_orders: settledByPhone.get(c.phone) ?? 0,
        open_debt: openDebt,
      }
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

    return NextResponse.json(
      { customers, summary },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    return apiError(err)
  }
}
