import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'

export async function POST(req: Request) {
  try {
    const { items } = await req.json()
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    if (!deviceToken) return NextResponse.json({ discount: 0, discountPercent: 0, eligibleProductIds: [] })

    const deviceIdHash = hashData(deviceToken)
    const db = supabaseAdmin()

    const { data: member } = await db.from('organization_members').select('id, organization_id, organizations(name, discount_percent, max_daily_orders, max_total_orders, expires_at)').eq('device_id_hash', deviceIdHash).eq('is_registered', true).maybeSingle()
    if (!member || !member.organizations) return NextResponse.json({ discount: 0, discountPercent: 0, eligibleProductIds: [] })

    const org = member.organizations as any
    if (new Date(org.expires_at) < new Date()) return NextResponse.json({ discount: 0, discountPercent: 0, message: 'قرارداد منقضی شده', eligibleProductIds: [] })

    const today = new Date().toISOString().split('T')[0]
    const { count: dailyCount } = await db.from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id).gte('created_at', `${today}T00:00:00Z`)
    const { count: totalCount } = await db.from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id)

    // ✅ استفاده از ?? 0 برای جلوگیری از خطای null
    if ((dailyCount ?? 0) >= org.max_daily_orders) return NextResponse.json({ discount: 0, discountPercent: 0, message: 'سقف روزانه پر شده', eligibleProductIds: [] })
    if ((totalCount ?? 0) >= org.max_total_orders) return NextResponse.json({ discount: 0, discountPercent: 0, message: 'سقف کل پر شده', eligibleProductIds: [] })

    const productIds = items.map((i: any) => i.product_id)
    const { data: products } = await db.from('products').select('id, coupon_eligible, categories(coupon_eligible)').in('id', productIds)
    const productMap = new Map(products?.map(p => [p.id, p]))

    let eligibleSubtotal = 0
    const eligibleProductIds: string[] = []

    for (const item of items) {
      const p = productMap.get(item.product_id)
      if (!p) continue
      // ✅ استفاده از as any برای رفع خطای TypeScript در کوئری تودرتو
      const isProductEligible = p.coupon_eligible
      const isCategoryEligible = (p.categories as any)?.coupon_eligible
      const eligible = isProductEligible !== null ? isProductEligible : isCategoryEligible
      
      if (eligible) {
        eligibleSubtotal += (item.unit_price * item.quantity)
        eligibleProductIds.push(item.product_id)
      }
    }

    const discountAmount = Math.round((eligibleSubtotal * org.discount_percent) / 100)

    return NextResponse.json({
      discount: discountAmount,
      orgName: org.name,
      discountPercent: org.discount_percent,
      eligibleProductIds: [...new Set(eligibleProductIds)]
    })
  } catch (err) {
    return NextResponse.json({ discount: 0, discountPercent: 0, eligibleProductIds: [] })
  }
}