import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_METHODS: readonly string[] = ['cash', 'card', 'transfer']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, method } = body

    if (!orderId || !method) {
      return NextResponse.json(
        { error: 'orderId و method الزامی هستند' },
        { status: 400 }
      )
    }

    if (!VALID_METHODS.includes(method)) {
      return NextResponse.json(
        { error: 'روش پرداخت نامعتبر است' },
        { status: 400 }
      )
    }

    // ✅ استفاده از کلاینت ادمین برای دور زدن RLS
    const db = supabaseAdmin()

    const updates: Record<string, any> = {
      payment_method: method,
      payment_status: 'unpaid',
    }

    if (method === 'transfer') {
      updates.payment_status = 'pending_review'
    }

    // ✅ استفاده از select() برای مطمئن شدن از اعمال تغییرات
    const { data, error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select('id')

    if (error) {
      console.error('[payment/set-method] error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    if (!data || data.length === 0) {
      console.error('[payment/set-method] no rows updated:', orderId)
      return NextResponse.json({ error: 'سفارش یافت نشد یا تغییر نکرد' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[payment/set-method] unexpected:', err)
    return apiError(err)
  }
}