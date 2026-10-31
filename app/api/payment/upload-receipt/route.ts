import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'
import { paymentErrorMessage } from '@/lib/payment/methods'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId
    const receiptUrl = body?.receiptUrl
    const rawNote = body?.receiptNote ?? body?.note

    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'شناسه سفارش نامعتبر است' }, { status: 400 })
    }

    const hasUrl = typeof receiptUrl === 'string' && receiptUrl.length > 0
    const note =
      typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim().slice(0, 300) : null

    if (!hasUrl && !note) {
      return NextResponse.json({ error: 'رسید یا توضیحات الزامی است' }, { status: 400 })
    }

    if (hasUrl && (receiptUrl.length > 2000 || !/^https:\/\//i.test(receiptUrl))) {
      return NextResponse.json({ error: 'لینک رسید نامعتبر است' }, { status: 400 })
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش یافت نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, status, subtotal, deleted_at')
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .maybeSingle()

    if (orderErr) {
      console.error('[payment/upload-receipt] order error:', orderErr)
      return apiError(orderErr, 'خطای پایگاه داده')
    }
    if (!order) {
      return NextResponse.json({ error: 'سفارش یافت نشد' }, { status: 404 })
    }

    // ───── بدهی: سفارش تحویل‌شده → ثبت روی دفتر ─────
    if (order.status === 'delivered' && !order.deleted_at) {
      const { data: rows, error: rowsErr } = await db
        .from('order_payments')
        .select('amount, status')
        .eq('order_id', order.id)
        .in('status', ['confirmed', 'pending_review'])

      if (rowsErr) {
        console.error('[payment/upload-receipt] ledger read:', rowsErr)
        return apiError(rowsErr, 'خطای پایگاه داده')
      }

      if ((rows ?? []).some((r) => r.status === 'pending_review')) {
        return NextResponse.json(
          { error: 'رسید شما قبلاً ارسال شده و در انتظار تأیید مدیر است.' },
          { status: 409 }
        )
      }

      const paid = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const remaining = Number(order.subtotal) - paid
      if (remaining <= 0) {
        return NextResponse.json({ error: 'این سفارش قبلاً تسویه شده' }, { status: 400 })
      }

      const { error: addErr } = await db.rpc('add_order_payment', {
        p_order_id: order.id,
        p_method: 'transfer',
        p_amount: remaining,
        p_created_by: 'customer',
        p_status: 'pending_review',
        p_receipt_url: hasUrl ? receiptUrl : null,
        p_receipt_note: note,
      })

      if (addErr) {
        console.error('[payment/upload-receipt] add_order_payment:', addErr)
        return NextResponse.json({ error: paymentErrorMessage(addErr.message) }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    // ───── مسیر قبلی: سفارش‌های باز ─────
    const updates: Record<string, any> = { payment_status: 'pending_review' }
    if (hasUrl) updates.payment_receipt_url = receiptUrl
    if (note) updates.payment_note = note

    const { data, error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .eq('payment_method', 'transfer')
      .in('payment_status', ['unpaid', 'failed', 'pending_review'])
      .is('payment_receipt_url', null)
      .is('payment_note', null)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .is('deleted_at', null)
      .select('id')

    if (error) {
      console.error('[payment/upload-receipt] update error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'رسید شما قبلاً ارسال شده و در انتظار تأیید مدیر است، یا این سفارش قابل ثبت رسید نیست.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[payment/upload-receipt] unexpected:', err)
    return apiError(err)
  }
}
