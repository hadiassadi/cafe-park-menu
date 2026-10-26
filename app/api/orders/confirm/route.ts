import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'شناسه سفارش یافت نشد' }, { status: 400 })

    const db = supabaseAdmin()

    // تغییر وضعیت از pending به confirmed
    const { error } = await db
      .from('orders')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending') // فقط اگر هنوز pending باشه

    if (error) return apiError(error, 'خطای پایگاه داده')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}