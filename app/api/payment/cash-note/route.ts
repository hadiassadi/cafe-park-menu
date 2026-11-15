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

export const dynamic = 'force-dynamic'

/**
 * 🎯 پچ ۵۰-هـ-ن — اعلام بخش نقدی/کارت‌خوانِ پرداخت ترکیبی
 * مشتری اعلام می‌کند بخشی از مبلغ را هنگام تحویل/مراجعه نقدی می‌دهد؛ این بخش
 * روی دفتر ثبت «نمی‌شود» (پولی جابه‌جا نشده) و فقط به‌صورت یادداشت روی سفارش
 * می‌نشیند تا اپراتور موقع تسویه بداند. باقی‌ماندهٔ محاسباتی دست‌نخورده می‌ماند
 * و ادمین هنگام «ثبت پرداخت» همان بخش را تأیید می‌کند.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'شناسه سفارش نامعتبر است' }, { status: 400 })
    }

    if (!Number.isInteger(body?.amount) || body.amount <= 0) {
      return NextResponse.json({ error: 'مبلغ نامعتبر است' }, { status: 400 })
    }
    const amount = body.amount as number

    // 🎯 پچ ۵۰-هـ-ز: دسترسی با دستگاه یا شمارهٔ مشتری (سفارش حضوری POS)
    const deviceHashes = await getDeviceHashes()
    if (deviceHashes.length === 0) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()
    const devicePhone = await getDeviceCustomerPhone(db, deviceHashes)

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, status, subtotal, payment_note, deleted_at, device_id_hash, customer_phone')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr) {
      console.error('[payment/cash-note] order read:', orderErr)
      return apiError(orderErr, 'خطای پایگاه داده')
    }
    if (!order || !deviceOwnsOrderRow(order, deviceHashes, devicePhone)) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    if (order.deleted_at || ['cancelled', 'canceled'].includes(order.status)) {
      return NextResponse.json({ error: 'این سفارش لغو یا حذف شده است' }, { status: 400 })
    }

    // باقی‌مانده = مبلغ سفارش − پرداخت‌های تأییدشده/در انتظار
    const { data: rows, error: rowsErr } = await db
      .from('order_payments')
      .select('amount, status')
      .eq('order_id', order.id)
      .in('status', ['confirmed', 'pending_review'])

    if (rowsErr) {
      console.error('[payment/cash-note] ledger read:', rowsErr)
      return apiError(rowsErr, 'خطای پایگاه داده')
    }
    const paid = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const remaining = Number(order.subtotal) - paid

    if (remaining <= 0) {
      return NextResponse.json({ error: 'این سفارش قبلاً تسویه شده' }, { status: 400 })
    }
    if (amount > remaining) {
      return NextResponse.json({ error: 'مبلغ بیشتر از باقی‌مانده سفارش است' }, { status: 400 })
    }

    // یادداشت قبلی حفظ می‌شود؛ اعلام نقدی به آن اضافه می‌شود
    const prevNote = typeof order.payment_note === 'string' ? order.payment_note.trim() : ''
    const pledgeText = `🧩 اعلام نقدی در محل: ${amount.toLocaleString('fa-IR')} تومان (پرداخت ترکیبی)`
    const mergedNote = prevNote ? `${prevNote} | ${pledgeText}` : pledgeText

    const { error: updErr } = await db
      .from('orders')
      .update({ payment_note: mergedNote.slice(0, 500) })
      .eq('id', orderId)
      .is('deleted_at', null)

    if (updErr) {
      console.error('[payment/cash-note] update note:', updErr)
      return NextResponse.json({ error: 'خطا در ثبت اعلام نقدی' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[payment/cash-note] unexpected:', err)
    return apiError(err)
  }
}
