import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { findActiveTable } from '@/lib/orders/takeaway'
import { pricePosItems } from '@/lib/orders/pos-pricing'
import { hashData } from '@/lib/utils/hash'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS = 50
const MAX_QTY = 50

// 🎯 پچ ۵۰-هـ-و: ویرایش سفارش از POS — فقط تا قبل از شروع آماده‌سازی.
// وضعیت‌های قابل ویرایش: pending / confirmed (و نه تسویه‌شده).
// قیمت‌گذاری مجدد با همان lib ثبت؛ تخفیف با سقف اقلام مشمول؛
// سهمیهٔ تخفیف عضو: اگر فاکتور قبلاً مصرف داشته و تخفیف سازمانی بماند دست‌نخورده،
// در غیر این صورت رزرو جدید یا آزادسازی.

function normalizePhone(v: unknown): string {
  let p = String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
  if (/^9\d{9}$/.test(p)) p = '0' + p
  return p
}

function couponLabel(source: string | null): string | null {
  if (source === 'org' || source === 'stacked-org') return 'MEMBERSHIP'
  if (source === 'subscription' || source === 'stacked-sub') return 'SUBSCRIPTION'
  if (source === 'grade') return 'GRADE'
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.denied) return auth.denied

    const rl = rateLimit(req, 'admin-pos-order-update', 30, 60_000)
    if (!rl.ok) return tooMany(rl)

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'شناسهٔ سفارش نامعتبر است' }, { status: 400 })
    }

    const body: any = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // ---------- سفارش و گیت ویرایش ----------
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, order_number, status, payment_status')
      .eq('id', id)
      .maybeSingle()
    if (orderErr || !order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    const editable =
      (order.status === 'pending' || order.status === 'confirmed') &&
      order.payment_status !== 'paid'
    if (!editable) {
      return NextResponse.json(
        { error: 'این سفارش دیگر قابل ویرایش نیست (آماده‌سازی شروع شده یا تسویه شده است)' },
        { status: 409 }
      )
    }

    // ---------- مشتری ----------
    let phone = ''
    const rawPhone = String(body?.customer_phone ?? '').trim()
    if (rawPhone) {
      phone = normalizePhone(rawPhone)
      if (!/^09\d{9}$/.test(phone)) {
        return NextResponse.json({ error: 'شماره‌ی تلفن نامعتبر است' }, { status: 400 })
      }
    }
    let name = typeof body?.customer_name === 'string' ? body.customer_name.trim() : ''
    if (name.length > 60) {
      return NextResponse.json({ error: 'نام نامعتبر است' }, { status: 400 })
    }
    if (!name) name = phone ? 'مشتری' : 'مهمان'

    // ---------- میز و یادداشت ----------
    const tableNo =
      body?.table_number == null || body.table_number === ''
        ? null
        : Number.isInteger(Number(body.table_number)) &&
            Number(body.table_number) >= 1 &&
            Number(body.table_number) <= 999
          ? Number(body.table_number)
          : undefined
    if (tableNo === undefined) {
      return NextResponse.json({ error: 'شماره‌ی میز نامعتبر است' }, { status: 400 })
    }
    let tableRow: { id: string; number: number } | null = null
    if (tableNo !== null) {
      tableRow = await findActiveTable(db, tableNo)
      if (!tableRow) {
        return NextResponse.json(
          { error: 'این میز وجود ندارد یا غیرفعال است' },
          { status: 400 }
        )
      }
    }
    const cleanNote =
      typeof body?.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 600)
        : null

    // ---------- آیتم‌ها ----------
    const items = body?.items
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return NextResponse.json({ error: 'هیچ آیتمی انتخاب نشده است' }, { status: 400 })
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
        return NextResponse.json({ error: 'آیتم سفارش نامعتبر است' }, { status: 400 })
      }
    }

    // ---------- قیمت‌گذاری مشترک با ثبت ----------
    const priced = await pricePosItems(db, items)
    if (!priced.ok) {
      return NextResponse.json(
        { error: priced.error },
        { status: priced.status ?? 400 }
      )
    }
    const { serverItems, baseTotal, takeawayTotal, eligibleSubtotal } = priced.data
    const grossTotal = baseTotal + takeawayTotal

    // ---------- تخفیف — سقف همان اقلام مشمول ----------
    const rawDiscount = body?.manual_discount
    let manualDiscount = 0
    if (rawDiscount != null && rawDiscount !== '') {
      const parsed = Number(
        String(rawDiscount)
          .replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
          .replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
          .replace(/\D/g, '') || 0
      )
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'مبلغ تخفیف نامعتبر است' }, { status: 400 })
      }
      manualDiscount = Math.floor(parsed)
    }
    if (manualDiscount > eligibleSubtotal) {
      return NextResponse.json(
        { error: 'تخفیف بیشتر از اقلام مشمول تخفیف است' },
        { status: 400 }
      )
    }
    const discountSource =
      typeof body?.discount_source === 'string' ? body.discount_source : null

    // ---------- سهمیهٔ تخفیف عضو — رزرو/آزادسازی متناسب با ویرایش ----------
    const wantsOrgQuota =
      manualDiscount > 0 &&
      phone !== '' &&
      (discountSource === 'org' || discountSource === 'stacked-org')

    const { data: existingRedemptions } = await db
      .from('redemption_logs')
      .select('id')
      .eq('order_id', id)

    let keepRedemptionId: string | null = null
    if (wantsOrgQuota) {
      const existing = (existingRedemptions ?? [])[0]?.id ?? null
      if (existing) {
        keepRedemptionId = existing
      } else {
        const { data: orgMember } = await db
          .from('organization_members')
          .select(
            'id, organizations(discount_percent, max_daily_orders, max_total_orders, expires_at)'
          )
          .eq('phone_hash', hashData(phone))
          .eq('is_registered', true)
          .maybeSingle()
        const orgRow: any = (orgMember as any)?.organizations ?? null
        if (orgMember && orgRow && new Date(orgRow.expires_at) > new Date()) {
          const { data: redemptionId, error: reserveErr } = await db.rpc(
            'reserve_membership_redemption',
            {
              p_member_id: (orgMember as any).id,
              p_max_daily: orgRow.max_daily_orders,
              p_max_total: orgRow.max_total_orders,
            }
          )
          if (reserveErr) {
            console.error('[admin orders update] reserve:', reserveErr)
            return NextResponse.json(
              { error: 'خطا در ثبت سهمیهٔ تخفیف' },
              { status: 500 }
            )
          }
          if (!redemptionId) {
            return NextResponse.json(
              {
                error:
                  'اعتبار تخفیف عضو تمام شده است (سهمیهٔ امروز یا کل) — بدون تخفیف عضو ویرایش را ثبت کنید',
              },
              { status: 409 }
            )
          }
          keepRedemptionId = redemptionId as string
        }
      }
    } else if ((existingRedemptions ?? []).length > 0) {
      // تخفیف سازمانی برداشته شده → سهمیهٔ قبلی آزاد می‌شود
      for (const r of existingRedemptions ?? []) {
        const { error: delErr } = await db
          .from('redemption_logs')
          .delete()
          .eq('id', (r as any).id)
        if (delErr) console.error('[admin orders update] release:', delErr)
      }
    }

    // ---------- اعمال ویرایش ----------
    const { data: updated, error: updateErr } = await db
      .from('orders')
      .update({
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
        coupon_code: manualDiscount > 0 ? couponLabel(discountSource) : null,
        coupon_discount: manualDiscount > 0 ? manualDiscount : null,
      })
      .eq('id', id)
      .select('id, order_number, status, subtotal, customer_name, created_at')
      .single()

    if (updateErr || !updated) {
      console.error('[admin orders update]', updateErr)
      // رزرو تازه را پس بگیر تا سهمیه بدون سفارش مصرف نشود
      if (keepRedemptionId) {
        const { data: fresh, error: freshErr } = await db
          .from('redemption_logs')
          .select('id, order_id')
          .eq('id', keepRedemptionId)
          .maybeSingle()
        if (!freshErr && fresh && fresh.order_id == null) {
          await db.from('redemption_logs').delete().eq('id', keepRedemptionId)
        }
      }
      return NextResponse.json({ error: 'خطا در ثبت ویرایش' }, { status: 500 })
    }

    // رزرو تازه را به سفارش گره بزن
    if (keepRedemptionId) {
      const { data: fresh } = await db
        .from('redemption_logs')
        .select('id, order_id')
        .eq('id', keepRedemptionId)
        .maybeSingle()
      if (fresh && fresh.order_id == null) {
        const { error: linkErr } = await db
          .from('redemption_logs')
          .update({ order_id: id })
          .eq('id', keepRedemptionId)
        if (linkErr) console.error('[admin orders update] link:', linkErr)
      }
    }

    return NextResponse.json({ order: updated })
  } catch (err) {
    console.error('[admin orders update] unexpected:', err)
    return NextResponse.json({ error: 'خطای غیرمنتظره' }, { status: 500 })
  }
}
