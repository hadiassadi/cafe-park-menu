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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ orders: data || [] })
  } catch (err) {
    console.error('[Customer Orders] Error:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}