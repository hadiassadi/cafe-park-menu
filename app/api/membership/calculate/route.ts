import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'
import { rateLimit, tooMany } from '@/lib/rate-limit'

const ORG_MEMBER_SELECT = 'id, organization_id, organizations(name, discount_percent, max_daily_orders, max_total_orders, expires_at)'

function normalizePhone(v: unknown): string {
  return String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
    .replace(/^9(\d{9})$/, '0$1')
}

export async function POST(req: Request) {
  // بازدارنده‌ی اسپم: حداکثر ۱۲۰ درخواست در دقیقه از هر IP
  const rl = rateLimit(req, 'membership-calculate', 120, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const { items, phone } = await req.json()
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    if (!deviceToken && !phone) return NextResponse.json({ discount: 0, discountPercent: 0, eligibleProductIds: [] })

    const db = supabaseAdmin()

    // عضویت سازمانی: اول با دستگاه، اگر نبود با شماره تلفن تأییدشده (ثبت‌نام با دعوت مدیر
    // به شماره گره می‌خورد نه دستگاه — مشتری نباید برای تخفیف به یک دستگاه قفل شود)
    let member: any | undefined
    if (deviceToken) {
      const deviceIdHash = hashData(deviceToken)
      const { data } = await db.from('organization_members').select(ORG_MEMBER_SELECT).eq('device_id_hash', deviceIdHash).eq('is_registered', true).maybeSingle()
      member = data
    }
    if (!member && typeof phone === 'string') {
      const p = normalizePhone(phone)
      if (/^09\d{9}$/.test(p)) {
        const { data } = await db.from('organization_members').select(ORG_MEMBER_SELECT).eq('phone_hash', hashData(p)).eq('is_registered', true).maybeSingle()
        member = data
      }
    }
    if (!member || !member.organizations) return NextResponse.json({ discount: 0, discountPercent: 0, eligibleProductIds: [] })

    const org = member.organizations as any
    if (new Date(org.expires_at) < new Date()) return NextResponse.json({ discount: 0, discountPercent: 0, message: 'قرارداد منقضی شده', orgName: org.name, eligibleProductIds: [] })

    // شروع روز به وقت تهران — هم‌سو با reserve_membership_redemption (به‌جای UTC)
    const dayStartTehran = new Date(
      `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })}T00:00:00+03:30`
    ).toISOString()
    const { count: dailyCount } = await db.from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id).gte('created_at', dayStartTehran)
    const { count: totalCount } = await db.from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id)

    // ✅ استفاده از ?? 0 برای جلوگیری از خطای null
    if ((dailyCount ?? 0) >= org.max_daily_orders) return NextResponse.json({ discount: 0, discountPercent: 0, message: 'سقف تخفیف روزانهٔ شما به پایان رسیده است', orgName: org.name, eligibleProductIds: [] })
    if ((totalCount ?? 0) >= org.max_total_orders) return NextResponse.json({ discount: 0, discountPercent: 0, message: 'سقف کل تخفیف شما به پایان رسیده است', orgName: org.name, eligibleProductIds: [] })

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