import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value

    if (!deviceToken) {
      return NextResponse.json({ orders: [] })
    }

    const db = supabaseAdmin()

    // هش قدیمی (برای سفارش‌هایی که قبل از تغییرات ثبت شده‌اند)
    const oldDeviceIdHash = crypto.createHash('sha256').update(deviceToken).digest('hex')

    // هش جدید (برای سفارش‌های جدید با Salt)
    const newDeviceIdHash = hashData(deviceToken)

    // 🎯 پچ ۵۰-هـ-ذ + ۵۰-هـ-ر: سفارش‌های POS (حضوری، source=admin) هم به پنل مشتری
    // وصل می‌شوند. زنجیرهٔ شناسایی شمارهٔ مشتری:
    // ۱) آخرین سفارشِ دستگاهِ این مشتری → شماره‌اش (لنگر قبلی)
    // ۲) 🐛 فیکس ۵۰-هـ-ر: اگر لنگر نبود، ردیفِ customers وصل‌شده به همین دستگاه
    //    (عضو ثبت‌شده ممکن است هیچ سفارش آنلاینِ حاوی شماره از این دستگاه نداشته باشد)
    // ۳) و اگر آن هم نبود، شمارهٔ عضو سازمانیِ همان دستگاه (metadata._phone)
    const { data: anchor } = await db
      .from('orders')
      .select('customer_phone')
      .in('device_id_hash', [oldDeviceIdHash, newDeviceIdHash])
      .not('customer_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    let anchorPhone = String((anchor as any)?.customer_phone ?? '').trim()

    if (!anchorPhone) {
      const { data: custRow } = await db
        .from('customers')
        .select('phone')
        .in('device_id_hash', [oldDeviceIdHash, newDeviceIdHash])
        .not('phone', 'is', null)
        .limit(1)
        .maybeSingle()
      anchorPhone = String((custRow as any)?.phone ?? '').trim()
    }

    if (!anchorPhone) {
      const { data: orgRow } = await db
        .from('organization_members')
        .select('metadata')
        .in('device_id_hash', [oldDeviceIdHash, newDeviceIdHash])
        .eq('is_registered', true)
        .limit(1)
        .maybeSingle()
      anchorPhone = String((orgRow as any)?.metadata?._phone ?? '').trim()
    }

    let query = db
      .from('orders')
      .select('*')
      // 🎯 حذف‌شده‌ها و سفارش‌های تستی در پنل مشتری دیده نشوند
      .is('deleted_at', null)
      // 🐛 فیکس ۵۰-هـ-ر: neq ساده `is_test <> true` است و ردیف‌هایی که ستونشان
      // NULL است (سفارش‌های قدیمی) را هم کنار می‌گذارد — صریح و null-safe بنویسیم
      .or('is_test.is.null,is_test.eq.false')
      .order('created_at', { ascending: false })
      .limit(60)
    query = anchorPhone
      ? query.or(
          `device_id_hash.in.(${oldDeviceIdHash},${newDeviceIdHash}),customer_phone.eq.${anchorPhone}`
        )
      : query.in('device_id_hash', [oldDeviceIdHash, newDeviceIdHash])

    const { data, error } = await query

    if (error) {
      console.error('Orders Error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    const orders = data || []

    // جمع پرداخت‌های تأییدشده هر سفارش از دفتر پرداخت
    const paidByOrder: Record<string, number> = {}
    if (orders.length > 0) {
      const { data: payments, error: payErr } = await db
        .from('order_payments')
        .select('order_id, amount')
        .in('order_id', orders.map((o: any) => o.id))
        .eq('status', 'confirmed')

      if (payErr) {
        console.error('Payments Error:', payErr)
        return apiError(payErr, 'خطای پایگاه داده')
      }

      for (const p of payments ?? []) {
        paidByOrder[p.order_id] = (paidByOrder[p.order_id] ?? 0) + Number(p.amount)
      }
    }

    const withPaid = orders.map((o: any) => ({
      ...o,
      paid_amount: paidByOrder[o.id] ?? 0,
    }))

    return NextResponse.json({ orders: withPaid })

  } catch (err) {
    console.error('[Customer Orders] Error:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}