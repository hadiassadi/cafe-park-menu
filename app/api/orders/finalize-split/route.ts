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
import { sendPushToOrder } from '@/lib/push/send-push'

export const dynamic = 'force-dynamic'

/**
 * 🎯 پچ ۵۰-هـ-س — بررسی و نهایی‌کردن سفارش در «پرداخت ترکیبی» مشتری
 * مشتری بعد از پرداخت بخش‌ها (یا اعلام «پرداخت در محل» برای باقی‌مانده)
 * دکمهٔ «نهایی کردن سفارش» را می‌زند؛ سرور بررسی می‌کند:
 *   ۱) ماندهٔ واقعی = subtotal − (confirmed + pending_review)
 *   ۲) مجموع اعلام‌های نقدیِ ثبت‌شده در payment_note
 * اگر مانده صفر باشد یا اعلام نقدی آن را پوشش دهد → نهایی‌سازی واقعی:
 * customer_confirmed = true و سفارشِ pending به confirmed می‌رود (ورود به
 * جریان کافه/لیست فعال + پوش «تأیید شد» برای مشتری — مثل autoConfirmed ادمین)
 * و پیام متناسب برمی‌گردد؛ در غیر این صورت مانده + راهنمای روش‌ها.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'شناسه سفارش نامعتبر است' }, { status: 400 })
    }

    // 🎯 ۵۰-هـ-ز: دسترسی با دستگاه یا شمارهٔ مشتری (سفارش حضوری POS)
    const deviceHashes = await getDeviceHashes()
    if (deviceHashes.length === 0) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()
    const devicePhone = await getDeviceCustomerPhone(db, deviceHashes)

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select(
        'id, status, subtotal, payment_note, customer_confirmed, deleted_at, device_id_hash, customer_phone'
      )
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr) {
      console.error('[orders/finalize-split] order read:', orderErr)
      return apiError(orderErr, 'خطای پایگاه داده')
    }
    if (!order || !deviceOwnsOrderRow(order, deviceHashes, devicePhone)) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }
    if (order.deleted_at || ['cancelled', 'canceled'].includes(order.status)) {
      return NextResponse.json({ error: 'این سفارش لغو یا حذف شده است' }, { status: 400 })
    }

    // ماندهٔ واقعی از دفتر
    const { data: rows, error: rowsErr } = await db
      .from('order_payments')
      .select('amount, status')
      .eq('order_id', order.id)
      .in('status', ['confirmed', 'pending_review'])

    if (rowsErr) {
      console.error('[orders/finalize-split] ledger read:', rowsErr)
      return apiError(rowsErr, 'خطای پایگاه داده')
    }
    const paid = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const remaining = Math.max(0, Number(order.subtotal) - paid)
    const pledgedCash = parseCashPledges(order.payment_note)
    const fa = (n: number) => n.toLocaleString('fa-IR')

    // نهایی‌سازی واقعی — 🎯 پچ ۵۰-هـ-ص: مثل «تأیید پرداخت» ادمین (actions.ts
    // autoConfirmed)، سفارشِ در انتظار از pending به confirmed می‌رود تا واقعاً
    // وارد جریان کافه شود (لیست فعال POS + پنل مدیر) و مشتری هم پوش دریافت کند.
    const finalize = async () => {
      let changed = false
      if (!order.customer_confirmed || order.status === 'pending') {
        const updates: Record<string, unknown> = { customer_confirmed: true }
        if (order.status === 'pending') {
          updates.status = 'confirmed'
          updates.confirmed_at = new Date().toISOString()
        }
        const { data: upd, error: updErr } = await db
          .from('orders')
          .update(updates)
          .eq('id', order.id)
          .is('deleted_at', null)
          .select('id')
        if (updErr) {
          console.error('[orders/finalize-split] finalize:', updErr)
        }
        changed = (upd?.length ?? 0) > 0
      }
      if (changed) {
        // نوتیفیکیشن مشتری: «سفارش تأیید شد» — بهترین تلاش، خطا نادیده
        try {
          await sendPushToOrder(order.id, 'confirmed')
        } catch (e) {
          console.error('[orders/finalize-split] push:', e)
        }
      }
    }

    if (remaining <= 0) {
      await finalize()
      return NextResponse.json({
        finalized: true,
        remaining: 0,
        message:
          '✅ فاکتور کامل تسویه شد — سفارش نهایی شد و برای کافه ارسال شد.',
      })
    }

    if (pledgedCash >= remaining) {
      await finalize()
      return NextResponse.json({
        finalized: true,
        remaining,
        message: `✅ باقی‌ماندهٔ ${fa(remaining)} تومان به‌صورت «پرداخت در محل» اعلام شد — سفارش نهایی شد و برای کافه ارسال شد؛ پس از دریافت وجه، اپراتور آن را تأیید می‌کند.`,
      })
    }

    return NextResponse.json({
      finalized: false,
      remaining,
      message: `⏳ هنوز ${fa(remaining)} تومان از فاکتور تسویه نشده — با یکی از روش‌های زیر (درگاه آنلاین، کیف پول، کارت‌به‌کارت یا اعلام پرداخت در محل) تسویه رو نهایی کن.`,
    })
  } catch (err) {
    console.error('[orders/finalize-split] unexpected:', err)
    return apiError(err)
  }
}
