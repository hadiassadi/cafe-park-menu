import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { hashData } from '@/lib/utils/hash'
import crypto from 'crypto'
import 'server-only'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    if (!deviceToken) return NextResponse.json({ customer: null, membership: null })

    const deviceIdHashNew = hashData(deviceToken)
    const deviceIdHashOld = crypto.createHash('sha256').update(deviceToken).digest('hex')

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase admin env')
    
    const db = createClient(url, key, { auth: { persistSession: false } })

    // ۱. اطلاعات مشتری از آخرین سفارش (جستجو با هر دو هش)
    const { data: orderData } = await db
      .from('orders')
      .select('customer_name, customer_phone')
      .in('device_id_hash', [deviceIdHashOld, deviceIdHashNew])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customer = null
    if (orderData) customer = { name: orderData.customer_name, phone: orderData.customer_phone }

    // ۲. چک کردن عضویت
    let membership = null
    const { data: memberData } = await db
      .from('organization_members')
      .select('organization_id, metadata')
      .in('device_id_hash', [deviceIdHashOld, deviceIdHashNew])
      .eq('is_registered', true)
      .maybeSingle()

    if (memberData && memberData.organization_id) {
      const { data: orgData } = await db.from('organizations').select('name').eq('id', memberData.organization_id).single()
      if (orgData) membership = { orgId: memberData.organization_id, orgName: orgData.name }
      if (!customer && memberData.metadata?._display_name) {
        customer = { name: memberData.metadata._display_name, phone: memberData.metadata._phone || '' }
      }
    } else {
      // ✅ چک کردن عضویت عادی
      const { data: generalMember } = await db
        .from('customers')
        .select('phone, name')
        .in('device_id_hash', [deviceIdHashOld, deviceIdHashNew])
        .maybeSingle()

      if (generalMember) {
        membership = { orgId: 'general', orgName: 'باشگاه مشتریان کافه پارک' }
        if (!customer) customer = { name: generalMember.name || 'کاربر', phone: generalMember.phone }
      }
    }

    return NextResponse.json({ customer, membership }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ customer: null, membership: null }, { status: 500 })
  }
}