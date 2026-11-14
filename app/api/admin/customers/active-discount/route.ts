import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getGradeConfig, getVerifiedCustomerGrade } from '@/lib/customers/grades'
import { getActiveSubscriptionByPhone } from '@/lib/subscriptions/subscriptions'
import { combineDiscounts } from '@/lib/club/discount-policy'
import { hashData } from '@/lib/utils/hash'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-هـ: تخفیف فعال مشتری بر اساس شماره — نسخهٔ ادمینِ همان موتور پنل
// مشتری (/api/customer/active-discount) برای نمایش در ردیف مشتری POS.
// آینهٔ منطق /api/orders: سازمان×اشتراک → برندهٔ paid، سپس ترکیب با گرید بر
// اساس policy مدیر. هیچ مبلغی حساب نمی‌شود؛ فقط «الان کدام تخفیف برنده است»
// تا اپراتور قبل از زدن فاکتور بداند.

function normalizePhone(v: unknown): string {
  return String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
    .replace(/^9(\d{9})$/, '0$1')
}

export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-active-discount', 90, 60_000)
  if (!rl.ok) return tooMany(rl)

  const phone = normalizePhone(req.nextUrl.searchParams.get('phone') ?? '')
  if (!/^09\d{9}$/.test(phone)) {
    return NextResponse.json({ error: 'شمارهٔ تماس نامعتبر است' }, { status: 400 })
  }

  try {
    const db = supabaseAdmin()

    // پروفایل مشتری: نام + وضعیت تأیید (شرط گرید/اشتراک همان /api/orders است)
    const { data: customer } = await db
      .from('customers')
      .select('id, name, verification_status')
      .eq('phone', phone)
      .maybeSingle()

    // سازمان: عضو ثبت‌شده با شمارهٔ هش‌شده — همان شرط پنل مشتری
    const ORG_MEMBER_SELECT =
      'id, organizations(name, discount_percent, max_daily_orders, max_total_orders, expires_at)'
    const { data: member } = await db
      .from('organization_members')
      .select(ORG_MEMBER_SELECT)
      .eq('phone_hash', hashData(phone))
      .eq('is_registered', true)
      .maybeSingle()

    let orgPercent = 0
    let orgName: string | null = null
    let orgRemainingToday: number | null = null
    let orgTotalRemaining: number | null = null
    let orgNote: string | null = null
    if (member && (member as any).organizations) {
      const org = (member as any).organizations as any
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
          db
            .from('redemption_logs')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', (member as any).id)
            .gte('created_at', dayStartTehran),
          db
            .from('redemption_logs')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', (member as any).id),
        ])
        orgRemainingToday = Math.max(0, Number(org.max_daily_orders) - (daily.count ?? 0))
        orgTotalRemaining = Math.max(0, Number(org.max_total_orders) - (total.count ?? 0))
        if (orgRemainingToday === 0)
          orgNote = 'اعتبار سازمانی امروز تمام شده؛ فردا دوباره فعال می‌شود'
        else if (orgTotalRemaining === 0)
          orgNote = 'سهمیه کل تخفیف سازمانی به پایان رسیده است'
        if (orgRemainingToday > 0 && orgTotalRemaining > 0)
          orgPercent = Number(org.discount_percent)
      }
    }

    // گرید و اشتراک — فقط مشتری احرازشده (همان شرط /api/orders)
    const verified = customer?.verification_status === 'verified'
    let gradePercent = 0
    let gradeName: string | null = null
    let gradeColor: string | null = null
    let subPercent = 0
    let subPlanName: string | null = null
    if (verified) {
      const g = await getVerifiedCustomerGrade(phone).catch(() => null)
      gradePercent = g?.discountPercent ?? 0
      gradeName = g?.name ?? null
      gradeColor = g?.color ?? null
      const s = await getActiveSubscriptionByPhone(phone).catch(() => null)
      subPercent = s?.discountPercent ?? 0
      subPlanName = s?.planName ?? null
    }

    // همان ترکیب /api/orders — مبلغ نمادین روی ۱۰۰۰۰؛ برنده فقط به درصد‌ها وابسته است
    const paidPercent = Math.max(orgPercent, subPercent)
    const paidSource: 'org' | 'subscription' =
      subPercent > orgPercent ? 'subscription' : 'org'
    const config = await getGradeConfig()
    const combined = combineDiscounts({
      policy: config.policy,
      stackCapPercent: config.stackCapPercent,
      eligibleSubtotal: 10000,
      membershipPercent: paidPercent,
      gradePercent,
    })
    const winnerPercent = combined.discount / 100

    type ActiveInfo = {
      source: string
      label: string
      percent: number
      color: string | null
      orgName: string | null
      planName: string | null
      gradeName: string | null
    }
    let active: ActiveInfo | null = null
    if (combined.winner === 'membership' && paidPercent > 0) {
      active =
        paidSource === 'org'
          ? {
              source: 'org',
              label: `سازمانی «${orgName ?? ''}»`,
              percent: winnerPercent,
              color: '#4a7c9b',
              orgName,
              planName: null,
              gradeName: null,
            }
          : {
              source: 'subscription',
              label: `اشتراک «${subPlanName ?? ''}»`,
              percent: winnerPercent,
              color: '#4a2c73',
              orgName: null,
              planName: subPlanName,
              gradeName: null,
            }
    } else if (combined.winner === 'grade' && gradePercent > 0) {
      active = {
        source: 'grade',
        label: `گرید «${gradeName ?? ''}»`,
        percent: winnerPercent,
        color: gradeColor ?? '#6b4f3a',
        orgName: null,
        planName: null,
        gradeName,
      }
    } else if (combined.winner === 'stacked' && paidPercent > 0 && gradePercent > 0) {
      active =
        paidSource === 'org'
          ? {
              source: 'stacked-org',
              label: `سازمانی «${orgName ?? ''}» + گرید «${gradeName ?? ''}»`,
              percent: winnerPercent,
              color: '#4a7c9b',
              orgName,
              planName: null,
              gradeName,
            }
          : {
              source: 'stacked-sub',
              label: `اشتراک «${subPlanName ?? ''}» + گرید «${gradeName ?? ''}»`,
              percent: winnerPercent,
              color: '#4a2c73',
              orgName: null,
              planName: subPlanName,
              gradeName,
            }
    }

    // برچسب نوع عضویت برای ردیف POS (عادی / سازمانی / اشتراک / گرید)
    let membershipLabel = verified ? 'عضو عادی' : 'تأییدنشده'
    if (active) {
      if (active.source === 'org' || active.source === 'stacked-org') membershipLabel = 'سازمانی'
      else if (active.source === 'subscription' || active.source === 'stacked-sub')
        membershipLabel = 'اشتراک'
      else if (active.source === 'grade') membershipLabel = 'گرید'
    } else if (!verified && member && (member as any).organizations) {
      membershipLabel = 'سازمانی (تأییدنشده)'
    }

    return NextResponse.json(
      {
        customer_name: customer?.name ?? null,
        verification_status: customer?.verification_status ?? null,
        membership_label: membershipLabel,
        active,
        orgNote,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin/customers/active-discount]', err)
    return NextResponse.json(
      { customer_name: null, verification_status: null, membership_label: null, active: null, orgNote: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
