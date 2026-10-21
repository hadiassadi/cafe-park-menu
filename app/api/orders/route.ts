import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { hashData } from '@/lib/utils/hash'

export const dynamic = 'force-dynamic'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customer_name, customer_phone, table_number, note, items, subtotal, coupon_code } = body

    if (!customer_name || !customer_phone || !items || items.length === 0) {
      return NextResponse.json({ error: 'اطلاعات سفارش ناقص است' }, { status: 400 })
    }

    const db = createAdminDb()
    const cookieStore = await cookies()
    let deviceToken = cookieStore.get('cafe_device_token')?.value
    let isNewToken = false
    if (!deviceToken) { deviceToken = crypto.randomBytes(32).toString('hex'); isNewToken = true }
    
    const deviceIdHash = hashData(deviceToken)

    // ✅ ۱. بررسی تخفیف باشگاه (محاسبه مجدد سمت سرور برای امنیت)
    let membershipDiscount = 0
    let membershipMemberId = null

    const { data: member } = await db
      .from('organization_members')
      .select('id, organizations(name, discount_percent, max_daily_orders, max_total_orders, expires_at)')
      .eq('device_id_hash', deviceIdHash)
      .eq('is_registered', true)
      .maybeSingle()

    if (member && member.organizations) {
      const org = member.organizations as any
      const today = new Date().toISOString().split('T')[0]
      
      // چک کردن تاریخ انقضا و سقف‌ها
      const { count: dailyCount } = await db.from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id).gte('created_at', `${today}T00:00:00Z`)
      const { count: totalCount } = await db.from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id)

      if (new Date(org.expires_at) > new Date() && dailyCount < org.max_daily_orders && totalCount < org.max_total_orders) {
        // محاسبه اقلام مجاز
        const productIds = items.map((i: any) => i.product_id)
        const { data: products } = await db.from('products').select('id, coupon_eligible, categories(coupon_eligible)').in('id', productIds)
        const productMap = new Map(products?.map(p => [p.id, p]))

        let eligibleSubtotal = 0
        for (const item of items) {
          const p = productMap.get(item.product_id)
          if (!p) continue
          const eligible = p.coupon_eligible !== null ? p.coupon_eligible : p.categories?.coupon_eligible
          if (eligible) eligibleSubtotal += (item.unit_price * item.quantity)
        }
        
        membershipDiscount = Math.round((eligibleSubtotal * org.discount_percent) / 100)
        if (membershipDiscount > 0) membershipMemberId = member.id
      }
    }

    // ۲. تولید شماره سفارش
    const { data: lastOrder } = await db.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1).maybeSingle()
    const nextOrderNumber = (lastOrder?.order_number || 1000) + 1

    // ۳. ثبت سفارش
    const finalSubtotal = subtotal - membershipDiscount

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        order_number: nextOrderNumber,
        customer_name, customer_phone, table_number: table_number || null, note: note || null,
        items, subtotal: finalSubtotal, 
        coupon_code: coupon_code || (membershipDiscount > 0 ? 'MEMBERSHIP' : null),
        coupon_discount: membershipDiscount > 0 ? membershipDiscount : null,
        status: 'pending', payment_status: 'unpaid', payment_method: 'cash',
        device_id_hash: deviceIdHash,
      })
      .select().single()

    if (orderErr || !order) {
      console.error('[orders POST] error:', orderErr)
      return NextResponse.json({ error: 'خطا در ثبت سفارش' }, { status: 500 })
    }

    // ✅ ۴. ثبت در دفتر کل استفاده از تخفیف
    if (membershipMemberId && membershipDiscount > 0) {
      await db.from('redemption_logs').insert({ member_id: membershipMemberId, order_id: order.id })
    }

    // ۵. ست کردن کوکی
    const response = NextResponse.json({ order })
    if (isNewToken) {
      response.cookies.set('cafe_device_token', deviceToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/' })
    }

    return response
  } catch (err: any) {
    console.error('[orders POST] unexpected:', err)
    return NextResponse.json({ error: err?.message || 'خطای غیرمنتظره' }, { status: 500 })
  }
}