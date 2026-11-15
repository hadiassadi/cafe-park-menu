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

    // 🎯 پچ ۵۰-هـ-ن: مبلغ اختیاری برای پرداخت ترکیبی — رسید فقط بخشی از مبلغ را
    // پوشش می‌دهد و مدیر همان مبلغ را روی دفتر تأیید می‌کند
    let requestedAmount: number | null = null
    if (body?.amount !== undefined && body?.amount !== null) {
      if (!Number.isInteger(body.amount) || body.amount <= 0) {
        return NextResponse.json({ error: 'مبلغ نامعتبر است' }, { status: 400 })
      }
      requestedAmount = body.amount
    }

    // 🎯 پچ ۵۰-هـ-ز: دسترسی با دستگاه یا شمارهٔ مشتری (سفارش حضوری POS)
    const deviceHashes = await getDeviceHashes()
    if (deviceHashes.length === 0) {
      return NextResponse.json({ error: 'سفارش یافت نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()
    const devicePhone = await getDeviceCustomerPhone(db, deviceHashes)

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, status, subtotal, deleted_at, device_id_hash, customer_phone')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr) {
      console.error('[payment/upload-receipt] order error:', orderErr)
      return apiError(orderErr, 'خطای پایگاه داده')
    }
    if (!order || !deviceOwnsOrderRow(order, deviceHashes, devicePhone)) {
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
        // 🎯 پچ ۵۰-هـ-ن: در حالت ترکیبی مبلغ اعلامی مشتری، وگرنه کل باقی‌مانده
        p_amount: Math.min(requestedAmount ?? remaining, remaining),
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

    // ───── مسیر ترکیبی (پچ ۵۰-هـ-ن): سفارش‌های باز + مبلغ مشخص ─────
    // رسید فقط بخشی از مبلغ را پوشش می‌دهد → ردیف دفتر با همان مبلغ ثبت می‌شود
    // (مدیر با همان رابط تأیید رسیدِ دفتر، دقیقاً همان مبلغ را تأیید می‌کند) و
    // سفارش هم به «در انتظار بررسی» می‌رود تا در لیست رسیدهای ادمین دیده شود
    if (requestedAmount !== null) {
      const { data: rows2, error: rows2Err } = await db
        .from('order_payments')
        .select('amount, status')
        .eq('order_id', order.id)
        .in('status', ['confirmed', 'pending_review'])

      if (rows2Err) {
        console.error('[payment/upload-receipt] split ledger read:', rows2Err)
        return apiError(rows2Err, 'خطای پایگاه داده')
      }
      if ((rows2 ?? []).some((r) => r.status === 'pending_review')) {
        return NextResponse.json(
          { error: 'رسید شما قبلاً ارسال شده و در انتظار تأیید مدیر است.' },
          { status: 409 }
        )
      }

      const paid2 = (rows2 ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const remaining2 = Number(order.subtotal) - paid2
      if (remaining2 <= 0) {
        return NextResponse.json({ error: 'این سفارش قبلاً تسویه شده' }, { status: 400 })
      }

      const { error: addErr2 } = await db.rpc('add_order_payment', {
        p_order_id: order.id,
        p_method: 'transfer',
        p_amount: Math.min(requestedAmount, remaining2),
        p_created_by: 'customer',
        p_status: 'pending_review',
        p_receipt_url: hasUrl ? receiptUrl : null,
        p_receipt_note: note,
      })

      if (addErr2) {
        console.error('[payment/upload-receipt] split add_order_payment:', addErr2)
        return NextResponse.json({ error: paymentErrorMessage(addErr2.message) }, { status: 400 })
      }

      // وضعیت سفارش فقط برای نمایش در لیست رسیدهای در انتظار ادمین
      const orderUpdates: Record<string, any> = { payment_status: 'pending_review' }
      if (hasUrl) orderUpdates.payment_receipt_url = receiptUrl
      if (note) orderUpdates.payment_note = note
      const { error: ordErr2 } = await db
        .from('orders')
        .update(orderUpdates)
        .eq('id', orderId)
        .is('deleted_at', null)
      if (ordErr2) {
        console.error('[payment/upload-receipt] split order status:', ordErr2)
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
      .eq('payment_method', 'transfer')
      .in('payment_status', ['unpaid', 'failed', 'pending_review'])
      .is('payment_receipt_url', null)
      // 🎯 پچ ۵۰-هـ-ن: شرطِ «یادداشت خالی» حذف شد — اعلام نقدیِ ترکیبی نباید
      // جلوی آپلود رسیدِ معمولی را بگیرد
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
