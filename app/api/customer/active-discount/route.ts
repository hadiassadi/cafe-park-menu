import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveWalletCustomer } from '@/lib/wallet/wallet'
import { getGradeConfig, getVerifiedCustomerGrade } from '@/lib/customers/grades'
import { getActiveSubscriptionByPhone } from '@/lib/subscriptions/subscriptions'
import { combineDiscounts } from '@/lib/club/discount-policy'
import { hashData } from '@/lib/utils/hash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ActiveDiscountInfo = {
  source: 'org' | 'subscription' | 'grade' | 'stacked-org' | 'stacked-sub'
  label: string
  percent: number
  color: string | null
  orgName: string | null
  orgRemainingToday: number | null
  orgTotalRemaining: number | null
  planName: string | null
  gradeName: string | null
}

/**
 * منبع تخفیف فعال مشتری برای نمایش در پنل — آینه‌ی همان موتوری که در ثبت سفارش
 * (/api/orders) تصمیم می‌گیرد: سازمان×اشتراک → برنده‌ی paid، سپس ترکیب با گرید
 * بر اساس policy مدیر (بیشترین/اول باشگاه/اول گرید/تجمیعی). هیچ مبلغی اینجا حساب
 * نمی‌شود؛ فقط «الان کدام تخفیف برنده است» — برای شفافیت مشتری در پنل.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value

    // عضو سازمان — همان مسیر /api/orders (عضویت به دستگاه گره خورده است)
    let member: any | undefined
    if (deviceToken) {
      const deviceIdHash = hashData(deviceToken)
      const { data } = await supabaseAdmin()
        .from('organization_members')
        .select('id, organizations(name, discount_percent, max_daily_orders, max_total_orders, expires_at)')
        .eq('device_id_hash', deviceIdHash)
        .eq('is_registered', true)
        .maybeSingle()
      member = data
    }

    // نامزد سازمان: قرارداد معتبر + تخفیف مثبت + سهمیه‌ی باقی‌مانده (شمارش redemption، روز تهران)
    let orgPercent = 0
    let orgName: string | null = null
    let orgRemainingToday: number | null = null
    let orgTotalRemaining: number | null = null
    let orgNote: string | null = null
    if (member && member.organizations) {
      const org = member.organizations as any
      if (
        new Date(org.expires_at) > new Date() &&
        Number(org.discount_percent) > 0 &&
        typeof org.max_daily_orders === 'number' &&
        typeof org.max_total_orders === 'number'
      ) {
        orgName = String(org.name ?? '')
        const dayStartTehran = new Date(
          `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })}T00:00:00+03:30`
        ).toISOString()
        const [daily, total] = await Promise.all([
          supabaseAdmin().from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id).gte('created_at', dayStartTehran),
          supabaseAdmin().from('redemption_logs').select('*', { count: 'exact', head: true }).eq('member_id', member.id),
        ])
        orgRemainingToday = Math.max(0, Number(org.max_daily_orders) - (daily.count ?? 0))
        orgTotalRemaining = Math.max(0, Number(org.max_total_orders) - (total.count ?? 0))
        if (orgRemainingToday === 0) orgNote = 'اعتبار سازمانی امروز تمام شده؛ فردا دوباره فعال می‌شود'
        else if (orgTotalRemaining === 0) orgNote = 'سهمیه کل تخفیف سازمانی به پایان رسیده است'
        if (orgRemainingToday > 0 && orgTotalRemaining > 0) orgPercent = Number(org.discount_percent)
      }
    }

    // نامزد گرید و اشتراک — فقط مشتری احرازشده (همان شرط /api/orders)
    let gradePercent = 0
    let gradeName: string | null = null
    let gradeColor: string | null = null
    let subPercent = 0
    let subPlanName: string | null = null
    const customer = await resolveWalletCustomer()
    if (customer?.phone && customer.verification_status === 'verified') {
      const g = await getVerifiedCustomerGrade(customer.phone).catch(() => null)
      gradePercent = g?.discountPercent ?? 0
      gradeName = g?.name ?? null
      gradeColor = g?.color ?? null
      const s = await getActiveSubscriptionByPhone(customer.phone).catch(() => null)
      subPercent = s?.discountPercent ?? 0
      subPlanName = s?.planName ?? null
    }

    // همان ترکیب /api/orders: paid = حداکثر سازمان/اشتراک، سپس موتور policy با گرید.
    // مبلغ نمادین روی مبنای ۱۰۰۰۰ — برنده فقط به درصد‌ها وابسته است.
    const paidPercent = Math.max(orgPercent, subPercent)
    const paidSource: 'org' | 'subscription' = subPercent > orgPercent ? 'subscription' : 'org'
    const config = await getGradeConfig()
    const combined = combineDiscounts({
      policy: config.policy,
      stackCapPercent: config.stackCapPercent,
      eligibleSubtotal: 10000,
      membershipPercent: paidPercent,
      gradePercent,
    })
    const winnerPercent = combined.discount / 100

    let active: ActiveDiscountInfo | null = null
    if (combined.winner === 'membership' && paidPercent > 0) {
      active =
        paidSource === 'org'
          ? {
              source: 'org',
              label: `تخفیف سازمانی «${orgName ?? 'سازمان'}»`,
              percent: winnerPercent,
              color: '#4a7c9b',
              orgName,
              orgRemainingToday,
              orgTotalRemaining,
              planName: null,
              gradeName: null,
            }
          : {
              source: 'subscription',
              label: `تخفیف اشتراک «${subPlanName ?? ''}»`,
              percent: winnerPercent,
              color: '#4a2c73',
              orgName: null,
              orgRemainingToday: null,
              orgTotalRemaining: null,
              planName: subPlanName,
              gradeName: null,
            }
    } else if (combined.winner === 'grade' && gradePercent > 0) {
      active = {
        source: 'grade',
        label: `تخفیف گرید «${gradeName ?? ''}»`,
        percent: winnerPercent,
        color: gradeColor ?? '#6b4f3a',
        orgName: null,
        orgRemainingToday: null,
        orgTotalRemaining: null,
        planName: null,
        gradeName,
      }
    } else if (combined.winner === 'stacked' && paidPercent > 0 && gradePercent > 0) {
      active =
        paidSource === 'org'
          ? {
              source: 'stacked-org',
              label: `تخفیف سازمانی «${orgName ?? ''}» + گرید «${gradeName ?? ''}» (تجمیعی)`,
              percent: winnerPercent,
              color: '#4a7c9b',
              orgName,
              orgRemainingToday,
              orgTotalRemaining,
              planName: null,
              gradeName,
            }
          : {
              source: 'stacked-sub',
              label: `تخفیف اشتراک «${subPlanName ?? ''}» + گرید «${gradeName ?? ''}» (تجمیعی)`,
              percent: winnerPercent,
              color: '#4a2c73',
              orgName: null,
              orgRemainingToday: null,
              orgTotalRemaining: null,
              planName: subPlanName,
              gradeName,
            }
    }

    return NextResponse.json(
      { policy: config.policy, active, orgNote },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[active-discount][GET]', err)
    return NextResponse.json(
      { policy: null, active: null, orgNote: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
