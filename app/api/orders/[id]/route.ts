import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  getDeviceHashes,
  getDeviceCustomerPhone,
  deviceOwnsOrderRow,
  UUID_RE,
} from '@/lib/orders/owner'
import { parseCashPledges } from '@/lib/orders/cash-pledge'

export const dynamic = 'force-dynamic'

// فقط ستون‌هایی که صفحه‌ی مشتری استفاده می‌کند
const CUSTOMER_COLUMNS = [
  'id',
  'order_number',
  'customer_name',
  'customer_phone',
  'table_number',
  'note',
  'items',
  'subtotal',
  'original_subtotal',
  'coupon_code',
  'coupon_discount',
  'eligible_subtotal',
  'ineligible_subtotal',
  'takeaway_fee_total',
  'status',
  'created_at',
  'customer_confirmed',
  'cancellation_reason_label',
  'cancellation_note',
  'cancelled_by',
  'payment_method',
  'payment_status',
  'payment_ref_id',
  'payment_receipt_url',
  'payment_note',
  // 🐛 پچ ۵۰-هـ-او: paid_amount ستون orders نیست (منبعش جدول order_payments است؛
  // فیکس مشابه ۵۰-هـ-خ) — در select نیاید؛ پایین از دفتر حساب می‌شود
].join(',')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    // 🎯 پچ ۵۰-هـ-ز: دسترسی با دستگاه یا شمارهٔ مشتری — سفارش‌های حضوری (POS)
    // هش دستگاهی ندارند و با شمارهٔ عضو به پنل وصل می‌شوند
    const deviceHashes = await getDeviceHashes()
    if (deviceHashes.length === 0) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()
    const devicePhone = await getDeviceCustomerPhone(db, deviceHashes)

    const { data, error } = await db
      .from('orders')
      .select(CUSTOMER_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      // 🐛 پچ ۵۰-هـ-او: خطای دیتابیس نباید به «سفارش پیدا نشد» تبدیل شود
      console.error('[api/orders/[id]] select error:', error.message)
      return NextResponse.json(
        { error: 'خطا در خواندن سفارش از پایگاه داده' },
        { status: 500 }
      )
    }
    if (!data || !deviceOwnsOrderRow(data as any, deviceHashes, devicePhone)) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    // 🎯 پچ ۵۰-هـ-ن/او: paid_amount از دفتر پرداخت (جمع تأییدشده‌ها) — مثل
    // /api/customer/orders؛ برای باقی‌ماندهٔ پرداخت ترکیبی در صفحهٔ جزئیات
    let paidAmount = 0
    const { data: payRows, error: payErr } = await db
      .from('order_payments')
      .select('amount')
      .eq('order_id', id)
      .eq('status', 'confirmed')
    if (payErr) {
      console.error('[api/orders/[id]] payments sum error:', payErr.message)
    } else {
      paidAmount = (payRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
    }

        // فقط یک مقدار ساده؛ مبلغ و جزئیات مالی به مشتری نمی‌رسد
    let refundPending = false
    if ((data as any).status === 'cancelled') {
      const { data: refundRows, error: refundError } = await db
        .from('order_refunds')
        .select('id')
        .eq('order_id', id)
        .eq('status', 'pending_manual')
        .limit(1)

      if (refundError) {
        console.error('[api/orders/[id]] refund lookup error:', refundError)
      } else {
        refundPending = (refundRows?.length ?? 0) > 0
      }
    }

    return NextResponse.json(
      {
        order: {
          ...(data as any),
          paid_amount: paidAmount,
          refund_pending: refundPending,
          // 🎯 پچ ۵۰-هـ-ص: جمع اعلام‌های «پرداخت در محل» پرداخت ترکیبی — برای
          // بنر «سفارش نهایی شد و برای کافه ارسال شد» در صفحهٔ مشتری
          cash_pledge_total: parseCashPledges((data as any).payment_note),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )


  } catch (err: any) {
    console.error('[api/orders/[id]] error:', err)
    return apiError(err)
  }
}
