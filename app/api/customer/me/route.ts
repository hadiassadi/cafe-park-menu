import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value

    if (!deviceToken) {
      return NextResponse.json({ customer: null, membership: null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const deviceIdHash = hashData(deviceToken)
    const db = supabaseAdmin()

    // ۱. گرفتن اطلاعات مشتری از آخرین سفارش
    const { data: orderData } = await db
      .from('orders')
      .select('customer_name, customer_phone')
      .eq('device_id_hash', deviceIdHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customer = null
    if (orderData) {
      customer = { name: orderData.customer_name, phone: orderData.customer_phone }
    }

    // ۲. گرفتن اطلاعات عضویت سازمانی
    let membership = null
    const { data: memberData } = await db
      .from('organization_members')
      .select(`
        organization_id,
        organizations ( name )
      `)
      .eq('device_id_hash', deviceIdHash)
      .eq('is_registered', true)
      .maybeSingle()

    if (memberData && memberData.organizations) {
      membership = {
        orgId: memberData.organization_id,
        orgName: (memberData.organizations as any).name
      }
    }

    return NextResponse.json(
      { customer, membership },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('[Customer ME Error]:', err)
    return NextResponse.json({ customer: null, membership: null }, { status: 500 })
  }
}