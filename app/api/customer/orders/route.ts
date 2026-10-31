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

    const { data, error } = await db
      .from('orders')
      .select('*')
      .in('device_id_hash', [oldDeviceIdHash, newDeviceIdHash])
      .order('created_at', { ascending: false })

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