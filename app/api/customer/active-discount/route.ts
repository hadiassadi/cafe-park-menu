import 'server-only'
import { createHash } from 'crypto'
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

function normalizePhone(v: unknown): string {
  return String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
    .replace(/^9(\d{9})$/, '0$1')
}

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

    // مشتری نشست — برای fallback شماره و نامزد گرید/اشتراک
    const customer = await resolveWalletCustomer()

    // عضو سازمان — هم‌سو با /api/membership/calculate و /api/customer/me:
    // اول دستگاه (هر دو نسخه‌ی هش: HMAC جدید و sha256 قدیمی)، اگر نبود شمارهٔ
    // تأییدشدهٔ نشست — عضو نباید برای تخفیف به یک دستگاه قفل شود
    const ORG_MEMBER_SELECT =
      'id, organizations(name, discount_percent, max_daily_orders, max_total_orders, expires_at)'
    let member: any | undefined
    if (deviceToken) {
      const deviceIdHashNew = hashData(deviceToken)
      const deviceIdHashOld = createHash('sha256').update(deviceToken).digest('hex')
      const { data } = await supabaseAdmin()
        .from('organization_members')
        .select(ORG_MEMBER_SELECT)
        .in('device_id_hash', [deviceIdHashNew, deviceIdHashOld])
        .eq('is_registered', true)
        .maybeSingle()
      member = data
    }
    if (!member && customer?.phone && customer.verification_status === 'verified') {
      const p = normalizePhone(customer.phone)
      if (/^09\d{9}$/.test(p)) {
        const { data } = await supabaseAdmin()
          .from('organization_members')
          .select(ORG_MEMBER_SELECT)
          .eq('phone_hash', hashData(p))
          .eq('is_registered', true)
          .maybeSingle()
        member = data
      }
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
