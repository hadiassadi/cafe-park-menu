import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(req: NextRequest) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    // view=archived → فقط مشتریان آرشیوشده؛ پیش‌فرض → فقط فعال‌ها
    const view = req.nextUrl.searchParams.get('view') === 'archived' ? 'archived' : 'active'

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

    // خواندن اطلاعات مشتریان (یادداشت، تگ، تأیید شماره، وضعیت اعتبار، آرشیو)
    const { data: metaCustomers } = await db
      .from('customers')
      .select('phone, name, notes, tags, phone_verified_at, credit_override, verification_status, wallet_blocked, device_info, archived_at')

    const metaMap = new Map<
      string,
      {
        profile_name: string | null
        notes: string | null
        tags: string[]
        phone_verified_at: string | null
        credit_override: string
        verification_status: string | null
        wallet_blocked: boolean
        device_info: string | null
        archived_at: string | null
      }
    >()
    for (const c of metaCustomers ?? []) {
      if (!c.phone) continue
      metaMap.set(normalizePhone(c.phone), {
        profile_name: c.name ?? null,
        notes: c.notes || null,
        tags: Array.isArray(c.tags) ? c.tags : [],
        phone_verified_at: c.phone_verified_at ?? null,
        credit_override: c.credit_override || 'default',
        verification_status: c.verification_status ?? null,
        wallet_blocked: !!c.wallet_blocked,
        device_info: c.device_info ?? null,
        archived_at: c.archived_at ?? null,
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
        profile_name: meta?.profile_name ?? null,
        verification_status: meta?.verification_status ?? null,
        wallet_blocked: meta?.wallet_blocked ?? false,
        device_info: meta?.device_info ?? null,
        settled_orders: settledByPhone.get(c.phone) ?? 0,
        open_debt: openDebt,
        archived: !!meta?.archived_at,
        archived_at: meta?.archived_at ?? null,
      }
    })

    // مشتریانِ فقط-پروفایل (بدون هیچ سفارشی) که آرشیو شده‌اند — در نمای آرشیو هم دیده شوند
    const archivedMetaOnly = (metaCustomers ?? [])
      .filter(
        (c) =>
          c.archived_at &&
          c.phone &&
          !customerMap.has(normalizePhone(c.phone))
      )
      .map((c) => ({
        phone: normalizePhone(c.phone),
        name: c.name || 'بدون نام',
        order_count: 0,
        total_spent: 0,
        cancelled_count: 0,
        first_order_at: null,
        last_order_at: null,
        notes: c.notes || null,
        tags: Array.isArray(c.tags) ? c.tags : [],
        has_record: true,
        phone_verified_at: c.phone_verified_at ?? null,
        credit_override: c.credit_override || 'default',
        profile_name: c.name ?? null,
        verification_status: c.verification_status ?? null,
        wallet_blocked: !!c.wallet_blocked,
        device_info: c.device_info ?? null,
        settled_orders: 0,
        open_debt: 0,
        archived: true,
        archived_at: c.archived_at as string,
      }))

    const allRows = [...customers, ...archivedMetaOnly]
    const activeRows = allRows.filter((r) => !r.archived)
    const archivedRows = allRows
      .filter((r) => r.archived)
      .sort(
        (a, b) =>
          new Date(b.archived_at || 0).getTime() - new Date(a.archived_at || 0).getTime()
      )

    const finalCustomers = view === 'archived' ? archivedRows : activeRows

    finalCustomers.sort((a, b) => {
      const aTime = a.last_order_at ? new Date(a.last_order_at).getTime() : 0
      const bTime = b.last_order_at ? new Date(b.last_order_at).getTime() : 0
      return bTime - aTime
    })

    const summary = {
      total: finalCustomers.length,
      loyal: finalCustomers.filter((c) => c.order_count >= 5).length,
      new: finalCustomers.filter((c) => c.order_count === 1).length,
      inactive: finalCustomers.filter((c) => {
        if (!c.last_order_at) return false
        return new Date(c.last_order_at) < thirtyDaysAgo
      }).length,
      problematic: finalCustomers.filter((c) => c.cancelled_count >= 5).length,
      archived: archivedRows.length,
    }

    return NextResponse.json(
      { customers: finalCustomers, summary },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    return apiError(err)
  }
}
