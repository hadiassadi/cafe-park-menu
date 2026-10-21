import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { hashData } from '@/lib/utils/hash'
import 'server-only'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    if (!deviceToken) return NextResponse.json({ customer: null, membership: null })

    const deviceIdHash = hashData(deviceToken)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase admin env')
    
    const db = createClient(url, key, { auth: { persistSession: false } })

    // ۱. اطلاعات مشتری
    const { data: orderData } = await db.from('orders').select('customer_name, customer_phone').eq('device_id_hash', deviceIdHash).order('created_at', { ascending: false }).limit(1).maybeSingle()

    // ۲. اطلاعات عضویت
    let membership = null
    const { data: memberData } = await db.from('organization_members').select('organization_id, metadata').eq('device_id_hash', deviceIdHash).eq('is_registered', true).maybeSingle()

    let customer = null
    if (orderData) {
      customer = { name: orderData.customer_name, phone: orderData.customer_phone }
    } else if (memberData && memberData.metadata && memberData.metadata._display_name) {
      // ✅ اگر سفارش نداشت، از اطلاعات ثبت‌نام استفاده کن
      customer = { name: memberData.metadata._display_name, phone: memberData.metadata._phone || '' }
    }

    if (memberData && memberData.organization_id) {
      const { data: orgData } = await db.from('organizations').select('name').eq('id', memberData.organization_id).single()
      if (orgData) membership = { orgId: memberData.organization_id, orgName: orgData.name }
    }

    return NextResponse.json({ customer, membership }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ customer: null, membership: null }, { status: 500 })
  }
}