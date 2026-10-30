import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { hashData } from '@/lib/utils/hash'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS = 50
const MAX_QTY = 50
const CANCELLED_LIST = '(cancelled,canceled)'

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
    let body: any
    try {
      body = await request.json()
    } catch {
      return bad('درخواست نامعتبر است')
    }

    const { customer_name, customer_phone, table_number, note, items, subtotal, coupon_code } =
      body ?? {}

    // ---------- اعتبارسنجی ورودی ----------
    const name = typeof customer_name === 'string' ? customer_name.trim() : ''
    if (!name || name.length > 60) return bad('نام نامعتبر است')

    const phone = normalizePhone(customer_phone)
    if (!/^09\d{9}$/.test(phone)) return bad('شماره‌ی تلفن نامعتبر است')

    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return bad('اطلاعات سفارش ناقص است')
    }

    for (const it of items) {
      if (
        !it ||
        typeof it.product_id !== 'string' ||
        !UUID_RE.test(it.product_id) ||
        !Number.isInteger(it.quantity) ||
        it.quantity < 1 ||
        it.quantity > MAX_QTY ||
        (it.option_id != null && (typeof it.option_id !== 'string' || !UUID_RE.test(it.option_id)))
      ) {
        return bad('آیتم سفارش نامعتبر است')
      }
    }

    const tableNo =
      table_number == null || table_number === ''
        ? null
        : Number.isInteger(Number(table_number)) &&
            Number(table_number) >= 1 &&
            Number(table_number) <= 999
          ? Number(table_number)
          : undefined
    if (tableNo === undefined) return bad('شماره‌ی میز نامعتبر است')

    const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null
    const cleanCoupon =
      typeof coupon_code === 'string' && coupon_code.trim()
        ? coupon_code.trim().toUpperCase().slice(0, 50)
        : null

    const db = createAdminDb()

    // ---------- قیمت‌گذاری سمت سرور ----------
    const productIds = [...new Set(items.map((i: any) => i.product_id as string))]
    const optionIds = [
      ...new Set(items.filter((i: any) => i.option_id).map((i: any) => i.option_id as string)),
    ]

    const { data: products, error: prodErr } = await db
      .from('products')
      .select('id, name, price, is_active, is_available, coupon_eligible, categories(coupon_eligible)')
      .in('id', productIds)
    if (prodErr || !products) {
      console.error('[orders POST] products:', prodErr)
      return bad('خطا در ثبت سفارش', 500)
    }
    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]))

    const { data: requiredGroups, error: reqErr } = await db
      .from('variant_groups')
      .select('id, product_id')
      .in('product_id', productIds)
      .eq('is_required', true)
    if (reqErr) {
      console.error('[orders POST] groups:', reqErr)
      return bad('خطا در ثبت سفارش', 500)
    }

    let optionMap = new Map<string, any>()
    if (optionIds.length > 0) {
      const { data: options, error: optErr } = await db
        .from('variant_options')
        .select('id, group_id, name, price_modifier, is_available, variant_groups(product_id, name)')
        .in('id', optionIds)
      if (optErr || !options) {
        console.error('[orders POST] options:', optErr)
        return bad('خطا در ثبت سفارش', 500)
      }
      optionMap = new Map<string, any>(options.map((o: any) => [o.id, o]))
    }

    const serverItems: any[] = []
    let baseTotal = 0
    let eligibleSubtotal = 0

    for (const it of items) {
      const p = productMap.get(it.product_id)
      if (!p || !p.is_active || p.is_available === false) {
        return bad('یکی از محصولات سفارش در دسترس نیست')
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
        const needsOption = (requiredGroups ?? []).some((g: any) => g.product_id === it.product_id)
        if (needsOption) return bad('انتخاب گزینه‌ی محصول الزامی است')
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

    // فقط برای عیب‌یابی
    const clientOriginal = Number(body?.original_subtotal)
	    const INITIAL_METHODS = ['cash', 'card', 'transfer', 'online']
    const initialMethod: string = INITIAL_METHODS.includes(body?.payment_method)
      ? body.payment_method
      : 'cash'
    if (Number.isFinite(clientOriginal) && clientOriginal !== baseTotal) {
      console.warn('[orders POST] price mismatch', { clientOriginal, baseTotal })
    }

    // ---------- دستگاه و قفل سفارش ----------
    const cookieStore = await cookies()
    let deviceToken = cookieStore.get('cafe_device_token')?.value
    let isNewToken = false
    if (!deviceToken) {
      deviceToken = crypto.randomBytes(32).toString('hex')
      isNewToken = true
    }
    const deviceIdHash = hashData(deviceToken)

    const { data: activeOrders, error: activeError } = await db
      .from('orders')
      .select('id')
      .eq('device_id_hash', deviceIdHash)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .is('deleted_at', null)
      .limit(1)

    if (activeError) {
      console.error('[Order Lock] error:', activeError)
      return bad('خطا در ثبت سفارش', 500)
    }
    if (activeOrders && activeOrders.length > 0) {
      return bad(
        'شما یک سفارش در جریان دارید. برای ثبت سفارش جدید، لطفاً تا تحویل سفارش قبلی صبر کنید یا با پرسنل کافه هماهنگ کنید.'
      )
    }

    // ---------- تخفیف باشگاه ----------
    let membershipDiscount = 0
    let membershipMemberId: string | null = null

    const { data: member } = await db
      .from('organization_members')
      .select(
        'id, organizations(name, discount_percent, max_daily_orders, max_total_orders, expires_at)'
      )
      .eq('device_id_hash', deviceIdHash)
      .eq('is_registered', true)
      .maybeSingle()

    if (member && member.organizations) {
      const org = member.organizations as any
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })
      const dayStart = `${today}T00:00:00+03:30`

      const { count: dailyCount } = await db
        .from('redemption_logs')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .gte('created_at', dayStart)
      const { count: totalCount } = await db
        .from('redemption_logs')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id)

      if (
        new Date(org.expires_at) > new Date() &&
        (dailyCount ?? 0) < org.max_daily_orders &&
        (totalCount ?? 0) < org.max_total_orders
      ) {
        membershipDiscount = Math.round((eligibleSubtotal * org.discount_percent) / 100)
        if (membershipDiscount > 0) membershipMemberId = member.id
      }
    }

    // ---------- کوپن (فقط اگر عضو باشگاه نیست) ----------
    let couponDiscount = 0
    let appliedCouponCode: string | null = null

    if (cleanCoupon && membershipDiscount === 0) {
      const { data: c, error: cErr } = await db
        .from('coupons')
        .select(
          'code, discount_type, discount_value, min_order_amount, max_order_amount, max_discount, max_uses, used_count, valid_from, valid_until, is_active'
        )
        .eq('code', cleanCoupon)
        .maybeSingle()

      if (cErr) {
        console.error('[orders POST] coupon:', cErr)
        return bad('خطا در ثبت سفارش', 500)
      }

      const now = new Date()
      const invalid =
        !c ||
        !c.is_active ||
        (c.valid_from && new Date(c.valid_from) > now) ||
        (c.valid_until && new Date(c.valid_until) < now) ||
        (c.min_order_amount != null && baseTotal < Number(c.min_order_amount)) ||
        (c.max_order_amount != null && baseTotal > Number(c.max_order_amount))
      if (invalid) return bad('کد تخفیف نامعتبر یا منقضی است')

      // آیا همین مشتری (با تلفن یا دستگاه) قبلاً از این کد استفاده کرده؟
      // سفارش‌های لغوشده یا حذف‌شده حساب نمی‌شوند.
      const { data: prevUse, error: prevErr } = await db
        .from('orders')
        .select('id')
        .eq('coupon_code', c!.code)
        .is('deleted_at', null)
        .not('status', 'in', CANCELLED_LIST)
        .or(`customer_phone.eq.${phone},device_id_hash.eq.${deviceIdHash}`)
        .limit(1)
      if (prevErr) {
        console.error('[orders POST] coupon prev-use:', prevErr)
        return bad('خطا در ثبت سفارش', 500)
      }
      if (prevUse && prevUse.length > 0) {
        return bad('شما قبلاً از این کد تخفیف استفاده کرده‌اید')
      }

      if (c!.max_uses != null && (c!.used_count ?? 0) >= c!.max_uses) {
        return bad('ظرفیت استفاده از این کد تخفیف پر شده است')
      }

      const type = String(c!.discount_type).toLowerCase()
      const value = Number(c!.discount_value)
      if (['percent', 'percentage'].includes(type)) {
        couponDiscount = Math.round((eligibleSubtotal * value) / 100)
      } else if (['fixed', 'amount', 'fixed_amount'].includes(type)) {
        couponDiscount = Math.min(value, eligibleSubtotal)
      } else {
        console.error('[orders POST] unknown discount_type:', c!.discount_type)
        return bad('کد تخفیف قابل استفاده نیست')
      }
      if (c!.max_discount != null) couponDiscount = Math.min(couponDiscount, Number(c!.max_discount))
      couponDiscount = Math.max(0, Math.round(couponDiscount))
      if (couponDiscount > 0) appliedCouponCode = c!.code
    }

    const totalDiscount = membershipDiscount + couponDiscount
    const finalSubtotal = Math.max(0, baseTotal - totalDiscount)

    // فقط برای عیب‌یابی
    if (Number.isFinite(Number(subtotal)) && Number(subtotal) !== finalSubtotal) {
      console.warn('[orders POST] subtotal mismatch', { client: subtotal, server: finalSubtotal })
    }

    // ---------- مصرف اتمیک کوپن ----------
    if (appliedCouponCode) {
      const { data: consumed, error: consumeErr } = await db.rpc('consume_coupon', {
        p_code: appliedCouponCode,
      })
      if (consumeErr) {
        console.error('[orders POST] consume_coupon:', consumeErr)
        return bad('خطا در ثبت سفارش', 500)
      }
      if (!consumed) return bad('ظرفیت استفاده از این کد تخفیف پر شده است')
    }

    // ---------- ثبت سفارش ----------
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
          subtotal: finalSubtotal,
          original_subtotal: baseTotal,
          eligible_subtotal: eligibleSubtotal,
          ineligible_subtotal: baseTotal - eligibleSubtotal,
          coupon_code: membershipDiscount > 0 ? 'MEMBERSHIP' : appliedCouponCode,
          coupon_discount: totalDiscount > 0 ? totalDiscount : null,
          status: 'pending',
          payment_status: 'unpaid',
          payment_method: initialMethod,
          device_id_hash: deviceIdHash,
        })
        .select('id, order_number, status, subtotal, created_at')
        .single()

      order = res.data
      orderErr = res.error
      if (!orderErr) break
      if (orderErr.code !== '23505') break
    }

    if (orderErr || !order) {
      console.error('[orders POST] error:', orderErr)
      if (appliedCouponCode) {
        const { error: relErr } = await db.rpc('release_coupon', { p_code: appliedCouponCode })
        if (relErr) console.error('[orders POST] release_coupon:', relErr)
      }
      return bad('خطا در ثبت سفارش', 500)
    }

    if (membershipMemberId && membershipDiscount > 0) {
      const { error: logErr } = await db
        .from('redemption_logs')
        .insert({ member_id: membershipMemberId, order_id: order.id })
      if (logErr) console.error('[orders POST] redemption_logs:', logErr)
    }

    const response = NextResponse.json({ order })
    if (isNewToken) {
      response.cookies.set('cafe_device_token', deviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      })
    }
    return response
  } catch (err: any) {
    console.error('[orders POST] unexpected:', err)
    return apiError(err)
  }
}
