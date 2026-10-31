import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS = 50
const MAX_QTY = 50

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizePhone(v: unknown): string {
  let p = String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
  if (/^9\d{9}$/.test(p)) p = '0' + p
  return p
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if (auth.denied) return auth.denied

    let body: any
    try {
      body = await request.json()
    } catch {
      return bad('درخواست نامعتبر است')
    }

    const { customer_name, customer_phone, table_number, note, items } = body ?? {}

    // ---------- مشتری: با نام یا بی‌نام ----------
    const rawPhone = String(customer_phone ?? '').trim()
    let phone = ''
    if (rawPhone) {
      phone = normalizePhone(rawPhone)
      if (!/^09\d{9}$/.test(phone)) return bad('شماره‌ی تلفن نامعتبر است')
    }

    let name = typeof customer_name === 'string' ? customer_name.trim() : ''
    if (name.length > 60) return bad('نام نامعتبر است')
    if (!name) name = phone ? 'مشتری' : 'مهمان'

    // ---------- میز و یادداشت ----------
    const tableNo =
      table_number == null || table_number === ''
        ? null
        : Number.isInteger(Number(table_number)) &&
            Number(table_number) >= 1 &&
            Number(table_number) <= 999
          ? Number(table_number)
          : undefined
    if (tableNo === undefined) return bad('شماره‌ی میز نامعتبر است')

    const cleanNote =
      typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null

    // ---------- آیتم‌ها ----------
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return bad('هیچ آیتمی انتخاب نشده است')
    }
    for (const it of items) {
      if (
        !it ||
        typeof it.product_id !== 'string' ||
        !UUID_RE.test(it.product_id) ||
        !Number.isInteger(it.quantity) ||
        it.quantity < 1 ||
        it.quantity > MAX_QTY ||
        (it.option_id != null &&
          (typeof it.option_id !== 'string' || !UUID_RE.test(it.option_id)))
      ) {
        return bad('آیتم سفارش نامعتبر است')
      }
    }

    const db = createAdminDb()

    const productIds = [...new Set(items.map((i: any) => i.product_id as string))]
    const optionIds = [
      ...new Set(items.filter((i: any) => i.option_id).map((i: any) => i.option_id as string)),
    ]

    const { data: products, error: prodErr } = await db
      .from('products')
      .select('id, name, price, is_active, is_available, coupon_eligible, categories(coupon_eligible)')
      .in('id', productIds)
    if (prodErr || !products) {
      console.error('[admin orders create] products:', prodErr)
      return bad('خطا در ثبت سفارش', 500)
    }
    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]))

    const { data: requiredGroups, error: reqErr } = await db
      .from('variant_groups')
      .select('id, product_id')
      .in('product_id', productIds)
      .eq('is_required', true)
    if (reqErr) {
      console.error('[admin orders create] groups:', reqErr)
      return bad('خطا در ثبت سفارش', 500)
    }

    let optionMap = new Map<string, any>()
    if (optionIds.length > 0) {
      const { data: options, error: optErr } = await db
        .from('variant_options')
        .select('id, group_id, name, price_modifier, is_available, variant_groups(product_id, name)')
        .in('id', optionIds)
      if (optErr || !options) {
        console.error('[admin orders create] options:', optErr)
        return bad('خطا در ثبت سفارش', 500)
      }
      optionMap = new Map<string, any>(options.map((o: any) => [o.id, o]))
    }

    // ---------- قیمت‌گذاری سمت سرور (بدون تخفیف) ----------
    const serverItems: any[] = []
    let baseTotal = 0
    let eligibleSubtotal = 0

    for (const it of items) {
      const p = productMap.get(it.product_id)
      if (!p || !p.is_active || p.is_available === false) {
        return bad('یکی از محصولات در دسترس نیست')
      }

      let optionName: string | null = null
      let groupName: string | null = null
      let modifier = 0

      if (it.option_id) {
        const o = optionMap.get(it.option_id)
        const grp: any = o?.variant_groups
        if (!o || o.is_available === false || !grp || grp.product_id !== it.product_id) {
          return bad('گزینه‌ی انتخاب‌شده نامعتبر است')
        }
        modifier = Number(o.price_modifier) || 0
        optionName = o.name
        groupName = grp.name
      } else {
        const needsOption = (requiredGroups ?? []).some(
          (g: any) => g.product_id === it.product_id
        )
        if (needsOption) return bad(`برای «${p.name}» انتخاب گزینه الزامی است`)
      }

      const unitPrice = it.option_id ? modifier : Number(p.price)
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return bad('قیمت نامعتبر است', 500)

      const lineTotal = unitPrice * it.quantity
      baseTotal += lineTotal

      const eligible =
        p.coupon_eligible === true
          ? true
          : p.coupon_eligible === false
            ? false
            : p.categories?.coupon_eligible === false
              ? false
              : true
      if (eligible) eligibleSubtotal += lineTotal

      serverItems.push({
        product_id: it.product_id,
        product_name: p.name,
        option_id: it.option_id ?? null,
        option_name: optionName,
        group_name: groupName,
        unit_price: unitPrice,
        quantity: it.quantity,
      })
    }

    // ---------- ثبت سفارش ----------
    const now = new Date().toISOString()
    let order: any = null
    let orderErr: any = null

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: lastOrder } = await db
        .from('orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextOrderNumber = (lastOrder?.order_number || 1000) + 1

      const res = await db
        .from('orders')
        .insert({
          order_number: nextOrderNumber,
          customer_name: name,
          customer_phone: phone,
          table_number: tableNo,
          note: cleanNote,
          items: serverItems,
          subtotal: baseTotal,
          original_subtotal: baseTotal,
          eligible_subtotal: eligibleSubtotal,
          ineligible_subtotal: baseTotal - eligibleSubtotal,
          status: 'confirmed',
          confirmed_at: now,
          payment_status: 'unpaid',
          payment_method: 'cash',
          source: 'admin',
        })
        .select('id, order_number, status, subtotal, customer_name, customer_phone, created_at')
        .single()

      order = res.data
      orderErr = res.error
      if (!orderErr) break
      if (orderErr.code !== '23505') break
    }

    if (orderErr || !order) {
      console.error('[admin orders create] insert:', orderErr)
      return bad('خطا در ثبت سفارش', 500)
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[admin orders create] unexpected:', err)
    return bad('خطای غیرمنتظره', 500)
  }
}
