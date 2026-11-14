import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { hashData } from '@/lib/utils/hash'
import { loadActiveFees, feeForProduct, findActiveTable } from '@/lib/orders/takeaway'

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
    const isTest = body?.is_test === true

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

    // 🎯 پچ ۵۰-هـ-د: توضیحات شامل پیام‌های آمادهٔ ردیف‌ها هم می‌شود — سقف ۶۰۰
    const cleanNote =
      typeof note === 'string' && note.trim() ? note.trim().slice(0, 600) : null

    // ---------- 🎯 پچ ۵۰-د: تخفیف دستی (POS) ----------
    const rawDiscount = body?.manual_discount
    let manualDiscount = 0
    if (rawDiscount != null && rawDiscount !== '') {
      const parsed = Number(
        String(rawDiscount)
          .replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
          .replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
          .replace(/\D/g, '') || 0
      )
      if (!Number.isFinite(parsed) || parsed < 0) return bad('مبلغ تخفیف نامعتبر است')
      manualDiscount = Math.floor(parsed)
    }

    // 🎯 پچ ۵۰-هـ-د: منبع تخفیف عضو — مبنای مصرف سهمیهٔ سازمانی
    const discountSource =
      typeof body?.discount_source === 'string' ? body.discount_source : null

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
let tableRow: { id: string; number: number } | null = null
if (tableNo !== null) {
  tableRow = await findActiveTable(db, tableNo)
  if (!tableRow) return bad('این میز وجود ندارد یا غیرفعال است')
}

    const productIds = [...new Set(items.map((i: any) => i.product_id as string))]
    const optionIds = [
      ...new Set(items.filter((i: any) => i.option_id).map((i: any) => i.option_id as string)),
    ]

    const { data: products, error: prodErr } = await db
      .from('products')
      .select('id, name, price, is_active, is_available, coupon_eligible, takeaway_fee_id, categories(coupon_eligible, takeaway_fee_id)')
      .in('id', productIds)
    if (prodErr || !products) {
      console.error('[admin orders create] products:', prodErr)
      return bad('خطا در ثبت سفارش', 500)
    }
    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]))
const feeMap = await loadActiveFees(db, products)

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
	let takeawayTotal = 0
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
const wantsTakeaway = it.takeaway === true
let takeawayFee = 0
let takeawayLabel: string | null = null
if (wantsTakeaway) {
  const f = feeForProduct(p, feeMap)
  if (!f) return bad(`بیرون‌بر برای «${p.name}» در دسترس نیست`)
  takeawayFee = f.fee
  takeawayLabel = f.name
  takeawayTotal += f.fee * it.quantity
}
      serverItems.push({
        product_id: it.product_id,
        product_name: p.name,
        // 🎯 پچ ۵۰-هـ-د: پیام آمادهٔ این ردیف — در فیش آشپزخانه چاپ می‌شود
        line_note:
          typeof it.line_note === 'string' && it.line_note.trim()
            ? it.line_note.trim().slice(0, 120)
            : null,
        option_id: it.option_id ?? null,
        option_name: optionName,
        group_name: groupName,
        unit_price: unitPrice,
        quantity: it.quantity,
		takeaway: wantsTakeaway,
		takeaway_fee: takeawayFee,
		takeaway_label: takeawayLabel,
      })
    }

    // ---------- 🎯 پچ ۵۰-د: اعتبارسنجی تخفیف ----------
    const grossTotal = baseTotal + takeawayTotal
    // 🎯 پچ ۵۰-هـ-د: تخفیف فقط روی اقلام مشمول — سقف واقعی سرور
    if (manualDiscount > eligibleSubtotal)
      return bad('تخفیف بیشتر از اقلام مشمول تخفیف است')

    // 🎯 پچ ۵۰-هـ-د: مصرف اعتبار تخفیف عضو سازمانی — همان مکانیزم ثبت آنلاین.
    // reserve_membership_redemption سهمیهٔ امروز/کل را اتمی رزرو می‌کند؛
    // اگر ظرفیت پر باشد، فاکتور با تخفیف عضو ثبت نمی‌شود و اپراتور مطلع می‌شود.
    let membershipRedemptionId: string | null = null
    const wantsOrgQuota =
      manualDiscount > 0 &&
      phone !== '' &&
      (discountSource === 'org' || discountSource === 'stacked-org')
    if (wantsOrgQuota) {
      const { data: orgMember } = await db
        .from('organization_members')
        .select(
          'id, organizations(discount_percent, max_daily_orders, max_total_orders, expires_at)'
        )
        .eq('phone_hash', hashData(phone))
        .eq('is_registered', true)
        .maybeSingle()
      const orgRow: any = (orgMember as any)?.organizations ?? null
      if (
        orgMember &&
        orgRow &&
        new Date(orgRow.expires_at) > new Date() &&
        Number(orgRow.discount_percent) > 0
      ) {
        const { data: redemptionId, error: reserveErr } = await db.rpc(
          'reserve_membership_redemption',
          {
            p_member_id: (orgMember as any).id,
            p_max_daily: orgRow.max_daily_orders,
            p_max_total: orgRow.max_total_orders,
          }
        )
        if (reserveErr) {
          console.error('[admin orders create] reserve_membership_redemption:', reserveErr)
          return bad('خطا در ثبت سهمیهٔ تخفیف', 500)
        }
        if (!redemptionId) {
          return bad(
            'اعتبار تخفیف عضو تمام شده است (سهمیهٔ امروز یا کل) — بدون تخفیف عضو ثبت کنید',
            409
          )
        }
        membershipRedemptionId = redemptionId as string
      }
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
      table_id: tableRow?.id ?? null,
      note: cleanNote,
      items: serverItems,
      subtotal: grossTotal - manualDiscount,
      original_subtotal: grossTotal,
      manual_discount: manualDiscount,
      eligible_subtotal: eligibleSubtotal,
      ineligible_subtotal: baseTotal - eligibleSubtotal + takeawayTotal,
      takeaway_fee_total: takeawayTotal,
      // 🎯 پچ ۵۰-هـ-د: منبع و مبلغ تخفیف روی فاکتور — در گردش خرید مشتری دیده می‌شود
      coupon_code:
        manualDiscount > 0
          ? discountSource === 'org' || discountSource === 'stacked-org'
            ? 'MEMBERSHIP'
            : discountSource === 'subscription' || discountSource === 'stacked-sub'
              ? 'SUBSCRIPTION'
              : discountSource === 'grade'
                ? 'GRADE'
                : null
          : null,
      coupon_discount: manualDiscount > 0 ? manualDiscount : null,
      status: 'confirmed',
      confirmed_at: now,
      payment_status: 'unpaid',
      payment_method: 'cash',
      source: 'admin',
	  is_test: isTest,
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
      if (membershipRedemptionId) {
        const { error: undoErr } = await db
          .from('redemption_logs')
          .delete()
          .eq('id', membershipRedemptionId)
        if (undoErr) console.error('[admin orders create] undo redemption:', undoErr)
      }
      return bad('خطا در ثبت سفارش', 500)
    }

    // 🎯 پچ ۵۰-هـ-د: رزرو سهمیه به سفارش گره می‌خورد — گردش تخفیف مشتری کامل می‌ماند
    if (membershipRedemptionId) {
      const { error: logErr } = await db
        .from('redemption_logs')
        .update({ order_id: order.id })
        .eq('id', membershipRedemptionId)
      if (logErr) console.error('[admin orders create] redemption link:', logErr)
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[admin orders create] unexpected:', err)
    return bad('خطای غیرمنتظره', 500)
  }
}
