// app/admin/page.tsx
// 🎯 پچ ۶۷ — بازسازی کامل داشبورد نقش‌آگاه
// 🎯 پچ ۶۸ — کپشن صفر کارت‌ها، شناسهٔ کوتاه و مبلغِ دفاعی سفارش‌های اخیر
// 🎯 پچ ۶۹ — تب‌های داخلی بخش‌ها (نمای کلی / نمودارها / پرفروش‌ها / ابزارها)
// 🎯 پچ ۷۰ — حذف دسترسی سریع تکراری، انتقال تاریخ/نقش به نوار وضعیت ثابت،
//   دسترسی مالی برای نقش‌های سفارشیِ دارای تیک «گزارش فروش»
// 🎯 پچ ۷۱ — سرعت و آمار شخصی:
//   • لود اولیه فقط آمار سبک ۳۵ روزه (getQuickStats) — نه شش ماه داده
//   • دادهٔ تب «نمودارها» و «پرفروش‌ها» فقط با باز شدن همان تب لود می‌شود
//     (ChartsPanel / TopProductsPanel از /api/admin/dashboard/stats)
//   • صندوق‌دار/کارمند: فقط آمار و سفارش‌های شخصی خودش (operator_id)
//     — دیگر آمار کل مجموعه را نمی‌بیند
//   • مبلغ واقعی از ستون subtotal و شمارهٔ واقعی سفارش از order_number
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { getOperatorRole } from '@/lib/admin/roles'
import { accessAllowsPath } from '@/lib/admin/modules'
import { getQuickStats, getOperatorStats } from '@/lib/dashboard-stats'
import { supabaseAdmin } from '@/lib/supabase/server'
import CleanupOrdersCard from './components/CleanupOrdersCard'
import ChartsPanel from './components/ChartsPanel'
import TopProductsPanel from './components/TopProductsPanel'
import SectionTabs, { type SectionTabDef } from './components/SectionTabs'
import './admin-dashboard.css'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

// برچسب وضعیت سفارش — مقدار ناشناخته همان متن خام نشان داده می‌شود (بدون کرش)
const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  confirmed: 'تأییدشده',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده',
  delivering: 'در حال ارسال',
  delivered: 'تحویل‌شده',
  completed: 'تکمیل‌شده',
  paid: 'پرداخت‌شده',
  unpaid: 'پرداخت‌نشده',
  cancelled: 'لغو شده',
  canceled: 'لغو شده',
}

const statusLabel = (v: unknown) =>
  STATUS_LABELS[String(v).toLowerCase()] ?? String(v)

const fmtDateTime = (v: unknown) => {
  try {
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('fa-IR', {
      timeZone: 'Asia/Tehran',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

// مبلغ را از هر شکلی (عدد یا رشتهٔ عددی) به عدد می‌رساند؛ مقدار نامعتبر → null
const parseAmount = (v: unknown): number | null => {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[,\s]/g, ''))
    if (isFinite(n)) return n
  }
  return null
}

// 🎯 پچ ۷۱: شمارهٔ واقعی سفارش (order_number از پچ ۵۱) — fallback شناسهٔ کوتاه
const displayOrderId = (row: Record<string, unknown>, fallback: number) => {
  const orderNumber = Number(row.order_number)
  if (Number.isFinite(orderNumber) && orderNumber > 0) {
    return String(orderNumber)
  }
  const s = String(row.id ?? '').trim()
  if (!s) return String(fallback + 1)
  return s.split('-')[0].toUpperCase().slice(0, 8)
}

// سفارش‌های اخیر — ستون‌های مشخص و فیلترهای همان stats.ts؛ سبک و امن.
// operatorId پاس شود → فقط سفارش‌های شخصیِ همان اپراتور (داشبورد صندوق‌دار).
async function fetchRecentOrders(
  operatorId?: string
): Promise<Record<string, unknown>[] | null> {
  try {
    const db = supabaseAdmin()
    let q = db
      .from('orders')
      .select('id, order_number, status, subtotal, created_at, operator_id')
      .is('deleted_at', null)
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(6)
    if (operatorId) q = q.eq('operator_id', operatorId)
    const { data, error } = await q
    if (error || !data || data.length === 0) return null
    return data as Record<string, unknown>[]
  } catch {
    return null
  }
}

function HeroStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: string
  label: string
  value: number
  tone?: 'gold' | 'green' | 'plain'
}) {
  return (
    <div className={`dash-hero-card${tone ? ` tone-${tone}` : ''}`}>
      <div className="dash-hero-icon">{icon}</div>
      <div className="dash-hero-value">{formatPrice(value)}</div>
      <div className="dash-hero-label">{label}</div>
      {/* صفرِ فارسی ریز است و کارت را «خالی» نشان می‌دهد — کپشن زیر کارت،
          صفرِ معنادار را جای خالیِ مشکوک عوض می‌کند */}
      {value === 0 && (
        <div className="dash-hero-zero">هنوز در این بازه چیزی ثبت نشده</div>
      )}
    </div>
  )
}

export default async function AdminDashboard() {
  // 🎯 گیت نشست — و شناسهٔ کاربر برای آمار شخصی (الگوی همان روت ثبت سفارش)
  const auth = await requireAdminUser()
  if (auth.denied || !auth.userId) redirect('/admin/login')
  const userId = auth.userId

  const me = await getOperatorRole()
  if (!me) redirect('/admin/login')

  const role = me.role
  const isOwner = role === 'owner'
  const canSeeFinance =
    role === 'owner' ||
    role === 'manager' ||
    (Array.isArray(me.allowedPaths) &&
      me.allowedPaths.length > 0 &&
      accessAllowsPath(role, me.allowedPaths, '/admin/reports/sales'))

  const allows = (href: string) => accessAllowsPath(role, me.allowedPaths, href)
  const canRegisterOrder = allows('/admin/orders/new')

  // 🎯 پچ ۷۱: آمار سبک — مالک/مدیر کل مجموعه، بقیه فقط شخصیِ خودشان
  const [quickStats, operatorStats, recentOrders] = await Promise.all([
    canSeeFinance ? getQuickStats() : Promise.resolve(null),
    canSeeFinance ? Promise.resolve(null) : getOperatorStats(userId),
    canSeeFinance ? fetchRecentOrders() : fetchRecentOrders(userId),
  ])

  // ── کارت‌های بالای داشبورد ──
  const heroCards = canSeeFinance
    ? [
        <HeroStat
          key="rev-today"
          icon="💰"
          label="فروش امروز (تومان)"
          value={quickStats?.today.revenue ?? 0}
          tone="gold"
        />,
        <HeroStat
          key="ord-today"
          icon="🛒"
          label="سفارش امروز"
          value={quickStats?.today.orders ?? 0}
          tone="green"
        />,
        <HeroStat
          key="rev-month"
          icon="🗓️"
          label="فروش این ماه (تومان)"
          value={quickStats?.month.revenue ?? 0}
        />,
      ]
    : [
        <HeroStat
          key="my-rev-today"
          icon="💰"
          label="فروش امروز من (تومان)"
          value={operatorStats?.today.revenue ?? 0}
          tone="gold"
        />,
        <HeroStat
          key="my-ord-today"
          icon="🛒"
          label="سفارش‌های امروز من"
          value={operatorStats?.today.orders ?? 0}
          tone="green"
        />,
        <HeroStat
          key="my-rev-month"
          icon="🗓️"
          label="فروش این ماه من (تومان)"
          value={operatorStats?.month.revenue ?? 0}
        />,
      ]

  /* ── تب «نمای کلی»: سفارش‌های اخیر (مالک/مدیر: همه — بقیه: فقط مال خودشان) ── */
  const recentOrdersTitle = canSeeFinance
    ? '🧾 سفارش‌های اخیر'
    : '🧾 سفارش‌های اخیر من'

  const recentOrdersSection = recentOrders ? (
    <section className="dashboard-section">
      <h2>{recentOrdersTitle}</h2>
      <div className="dash-recent">
        {recentOrders.map((o, i) => {
          const total = parseAmount(o.subtotal)
          const status = o.status
          return (
            <div key={String(o.id ?? i)} className="dash-recent-row">
              <span className="dash-recent-id">
                #{displayOrderId(o, i)}
              </span>
              {o.created_at ? (
                <span className="dash-recent-time">
                  {fmtDateTime(o.created_at)}
                </span>
              ) : null}
              {status ? (
                <span className={`dash-status s-${String(status)}`}>
                  {statusLabel(status)}
                </span>
              ) : null}
              {total !== null ? (
                <span className="dash-recent-amount">
                  {formatPrice(total)} تومان
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {canSeeFinance && allows('/admin/orders') && (
        <Link href="/admin/orders" className="dash-recent-more">
          مشاهدهٔ همهٔ سفارش‌ها ←
        </Link>
      )}
    </section>
  ) : (
    <section className="dashboard-section">
      <h2>{recentOrdersTitle}</h2>
      <div className="admin-card">
        <p className="empty-admin">
          {canSeeFinance
            ? 'هنوز سفارشی ثبت نشده است.'
            : 'هنوز سفارشی با نام تو ثبت نشده — با ثبت اولین سفارش، آمار شخصی‌ات همین‌جا دیده می‌شود.'}
        </p>
      </div>
    </section>
  )

  const cleanupSection = (
    <section className="dashboard-section">
      <h2>🧹 نگهداری دیتابیس</h2>
      <CleanupOrdersCard />
    </section>
  )

  /* ── چیدمان تب‌ها بر اساس نقش ──
     مالک/مدیر: نمای کلی | نمودارها | پرفروش‌ها (+ ابزارها فقط مالک)
     — دادهٔ نمودارها/پرفروش‌ها فقط با باز شدن تب لود می‌شود (لود تنبل)
     صندوق‌دار/کارمند: فقط «نمای کلی» شخصی → نوار تب نمایش داده نمی‌شود */
  const tabs: SectionTabDef[] = [
    {
      id: 'overview',
      icon: '🏠',
      label: 'نمای کلی',
      node: recentOrdersSection,
    },
  ]

  if (canSeeFinance) {
    tabs.push({
      id: 'charts',
      icon: '📈',
      label: 'نمودارها',
      node: <ChartsPanel />,
    })
    tabs.push({
      id: 'top-products',
      icon: '⭐',
      label: 'پرفروش‌ها',
      node: <TopProductsPanel />,
    })
  }

  if (isOwner) {
    tabs.push({
      id: 'tools',
      icon: '🧹',
      label: 'ابزارها',
      node: cleanupSection,
    })
  }

  return (
    <div className="dashboard">
      {/* خوش‌آمد + CTA — تاریخ و نشان نقش در نوار وضعیت ثابت بالای صفحه‌اند */}
      <div className="dashboard-welcome dash-welcome">
        <div>
          <h1>👋 خوش آمدی</h1>
          <p>
            {canSeeFinance
              ? 'خلاصهٔ عملکرد کافه پارک در یک نگاه'
              : 'خلاصهٔ عملکرد خودت در یک نگاه'}
          </p>
        </div>
        <div className="dash-welcome-side">
          {canRegisterOrder && (
            <Link href="/admin/orders/new" className="dash-cta">
              ➕ ثبت سفارش حضوری
            </Link>
          )}
        </div>
      </div>

      {/* 🎯 پچ ۷۱: سه کارت آماری — نقش‌آگاه؛ صندوق‌دار فقط آمار شخصی خودش */}
      <section className="dashboard-section">
        <div className="dash-hero">{heroCards}</div>
      </section>

      <SectionTabs tabs={tabs} />
    </div>
  )
}
