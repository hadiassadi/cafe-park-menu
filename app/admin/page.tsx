// app/admin/page.tsx
// 🎯 پچ ۶۷ — بازسازی کامل داشبورد: نقش‌آگاه و دسترسی‌آگاه
//   - مالک/مدیر: آمار کامل مالی، نمودارها، سفارش‌های اخیر، مقایسهٔ ماهانه
//   - صندوق‌دار/کارمند: فقط شمارش سفارش‌ها + میان‌برهای مجاز (بدون هیچ عدد مالی)
//   - پیوندهای میان‌بُر با همان گاردِ منو فیلتر می‌شوند (accessAllowsPath)
//   - نگهداری دیتابیس فقط برای مالک
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOrderStats } from '@/lib/stats'
import { getOperatorRole } from '@/lib/admin/roles'
import {
  accessAllowsPath,
  ADMIN_MODULES,
  type AdminModuleDef,
} from '@/lib/admin/modules'
import { ROLE_LABEL } from '@/lib/admin/role-matrix'
import { supabaseAdmin } from '@/lib/supabase/server'
import CleanupOrdersCard from './components/CleanupOrdersCard'
import './admin-dashboard.css'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

// برچسب وضعیت سفارش — مقدار ناشناخته همان متن خام نشان داده می‌شود (بدون کرش)
const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده',
  delivering: 'در حال ارسال',
  delivered: 'تحویل‌شده',
  completed: 'تکمیل‌شده',
  paid: 'پرداخت‌شده',
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

// سفارش‌های اخیر — کم‌ریسک‌ترین حالت: select('*') و خوانش دفاعی فیلدها.
// هر خطای کوئری/اسکیمای متفاوت فقط باعث مخفی‌شدن این بخش می‌شود، نه کرش صفحه.
async function fetchRecentOrders(): Promise<Record<string, unknown>[] | null> {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6)
    if (error || !data || data.length === 0) return null
    return data as Record<string, unknown>[]
  } catch {
    return null
  }
}

// 🎯 پچ ۶۷: میان‌برهای پیشنهادی داشبورد — از رجیستری ماژول‌ها برچسب و آیکون می‌گیرند
// و با گارد دسترسی فیلتر می‌شوند؛ پس هر نقش فقط میان‌برهای مجاز خودش را می‌بیند.
const QUICK_LINK_HREFS = [
  '/admin/orders',
  '/admin/orders/new',
  '/admin/shifts',
  '/admin/customers',
  '/admin/products',
  '/admin/categories',
  '/admin/tables',
  '/admin/memberships',
  '/admin/coupons',
  '/admin/wallet',
  '/admin/reports/sales',
  '/admin/cancellations',
  '/admin/settings',
  '/admin/users',
]

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
    </div>
  )
}

function ChangeBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span className="change-badge neutral">−</span>
  }
  const isPositive = value > 0
  return (
    <span
      className={`change-badge ${isPositive ? 'positive' : 'negative'}`}
    >
      {isPositive ? '↑' : '↓'} {Math.abs(value).toLocaleString('fa-IR')}٪
    </span>
  )
}

export default async function AdminDashboard() {
  // 🎯 گیت پروفایل پچ ۵۹-آ: بدون نشست یا بدون پروفایل اپراتوری → صفحهٔ ورود
  const me = await getOperatorRole()
  if (!me) redirect('/admin/login')

  const role = me.role
  const isOwner = role === 'owner'
  // عدد مالی (فروش) فقط برای مالک و مدیر — ماتریس پچ ۵۶: صندوق‌دار/کارمند
  // گزارش فروش ندارند، پس داشبورد هم هیچ عدد تومانی به آن‌ها نشان نمی‌دهد
  const canSeeFinance = role === 'owner' || role === 'manager'

  const stats = await getOrderStats()
  const recentOrders = canSeeFinance ? await fetchRecentOrders() : null

  // 🎯 پچ ۶۷: همان گاردِ منو (لیست دلخواه ثبت‌شده → ملاک؛ وگرنه پیش‌فرض نقش)
  const allows = (href: string) => accessAllowsPath(role, me.allowedPaths, href)

  const quickLinks: AdminModuleDef[] = QUICK_LINK_HREFS.map((href) =>
    ADMIN_MODULES.find((m) => m.href === href)
  ).filter((m): m is AdminModuleDef => !!m && allows(m.href))

  const canRegisterOrder = allows('/admin/orders/new')

  let todayFa = ''
  try {
    todayFa = new Date().toLocaleDateString('fa-IR', {
      timeZone: 'Asia/Tehran',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {}

  const maxRevenue = Math.max(
    ...stats.dailyRevenue.map((d) => d.revenue),
    1
  )
  const maxMonthlyRevenue = Math.max(
    ...stats.monthlyRevenue.map((m) => m.revenue),
    1
  )
  const maxPeakHour = Math.max(...stats.peakHours.map((h) => h.orders), 1)

  return (
    <div className="dashboard">
      {/* خوش‌آمد + نشان نقش + تاریخ + CTA ثبت سفارش */}
      <div className="dashboard-welcome dash-welcome">
        <div>
          <h1>👋 خوش آمدی</h1>
          <p>خلاصهٔ عملکرد کافه پارک در یک نگاه</p>
        </div>
        <div className="dash-welcome-side">
          <span className="dash-role-badge">{ROLE_LABEL[role]}</span>
          {todayFa && <span className="dash-date">{todayFa}</span>}
          {canRegisterOrder && (
            <Link href="/admin/orders/new" className="dash-cta">
              ➕ ثبت سفارش حضوری
            </Link>
          )}
        </div>
      </div>

      {/* 🎯 پچ ۶۷: سه ستون آماری اصلی — نقش‌آگاه */}
      <section className="dashboard-section">
        <div className="dash-hero">
          {canSeeFinance ? (
            <>
              <HeroStat
                icon="💰"
                label="فروش امروز (تومان)"
                value={stats.today.revenue}
                tone="gold"
              />
              <HeroStat
                icon="🛒"
                label="سفارش امروز"
                value={stats.today.orders}
                tone="green"
              />
              <HeroStat
                icon="🗓️"
                label="فروش این ماه (تومان)"
                value={stats.month.revenue}
              />
            </>
          ) : (
            <>
              <HeroStat
                icon="🛒"
                label="سفارش امروز"
                value={stats.today.orders}
                tone="green"
              />
              <HeroStat
                icon="📈"
                label="سفارش این هفته"
                value={stats.week.orders}
              />
              <HeroStat
                icon="🗓️"
                label="سفارش این ماه"
                value={stats.month.orders}
              />
            </>
          )}
        </div>
      </section>

      {/* 🎯 پچ ۶۷: سفارش‌های اخیر — فقط مالک/مدیر؛ خطای کوئری فقط بخش را مخفی می‌کند */}
      {canSeeFinance && recentOrders && (
        <section className="dashboard-section">
          <h2>🆕 سفارش‌های اخیر</h2>
          <div className="dash-recent">
            {recentOrders.map((o, i) => {
              const id = o.id
              const createdAt = o.created_at
              const status = o.status
              const total = o.total
              return (
                <div key={String(id ?? i)} className="dash-recent-row">
                  <span className="dash-recent-id">#{String(id ?? i)}</span>
                  {createdAt ? (
                    <span className="dash-recent-time">
                      {fmtDateTime(createdAt)}
                    </span>
                  ) : null}
                  {status ? (
                    <span className={`dash-status s-${String(status)}`}>
                      {statusLabel(status)}
                    </span>
                  ) : null}
                  {typeof total === 'number' ? (
                    <span className="dash-recent-amount">
                      {formatPrice(total)} تومان
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          {allows('/admin/orders') && (
            <Link href="/admin/orders" className="dash-recent-more">
              مشاهدهٔ همهٔ سفارش‌ها ←
            </Link>
          )}
        </section>
      )}

      {/* آمار تفصیلی و نمودارها — فقط مالک/مدیر */}
      {canSeeFinance && (
        <>
          {/* ✅ مقایسه با ماه قبل */}
          <section className="dashboard-section">
            <h2>📊 مقایسه با ماه قبل</h2>
            <div className="comparison-grid">
              <div className="comparison-card">
                <div className="comparison-header">
                  <span className="comparison-label">💰 فروش</span>
                  <ChangeBadge value={stats.comparison.revenueChange} />
                </div>
                <div className="comparison-value">
                  {formatPrice(stats.month.revenue)}
                  <small>تومان</small>
                </div>
              </div>

              <div className="comparison-card">
                <div className="comparison-header">
                  <span className="comparison-label">🛒 سفارش</span>
                  <ChangeBadge value={stats.comparison.ordersChange} />
                </div>
                <div className="comparison-value">
                  {formatPrice(stats.month.orders)}
                  <small>سفارش</small>
                </div>
              </div>

              <div className="comparison-card">
                <div className="comparison-header">
                  <span className="comparison-label">📈 میانگین هر سفارش</span>
                  <ChangeBadge value={stats.comparison.avgOrderChange} />
                </div>
                <div className="comparison-value">
                  {formatPrice(stats.avgOrderValue)}
                  <small>تومان</small>
                </div>
              </div>
            </div>
          </section>

          {/* نمودار فروش ۷ روز اخیر — 🎯 پچ ۶۷: مجموع هفته در زیرنویس برگشت */}
          <section className="dashboard-section">
            <h2>
              📉 فروش ۷ روز اخیر
              <small className="dash-section-note">
                مجموع این هفته: {formatPrice(stats.week.revenue)} تومان ·{' '}
                {formatPrice(stats.week.orders)} سفارش
              </small>
            </h2>
            <div className="chart-card">
              <div className="chart-bars">
                {stats.dailyRevenue.map((day) => {
                  const height =
                    maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                  return (
                    <div key={day.date} className="chart-col">
                      <div className="chart-col-value">
                        {day.revenue > 0 ? formatPrice(day.revenue) : ''}
                      </div>
                      <div className="chart-bar-wrapper">
                        <div
                          className="chart-bar"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                      </div>
                      <div className="chart-col-label">{day.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ✅ نمودار فروش ۶ ماه اخیر */}
          <section className="dashboard-section">
            <h2>📊 فروش ۶ ماه اخیر</h2>
            <div className="chart-card">
              <div className="chart-bars">
                {stats.monthlyRevenue.map((month) => {
                  const height =
                    maxMonthlyRevenue > 0
                      ? (month.revenue / maxMonthlyRevenue) * 100
                      : 0
                  return (
                    <div key={month.month} className="chart-col">
                      <div className="chart-col-value">
                        {month.revenue > 0 ? formatPrice(month.revenue) : ''}
                      </div>
                      <div className="chart-bar-wrapper">
                        <div
                          className="chart-bar"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                      </div>
                      <div className="chart-col-label">{month.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ✅ ساعات پرترافیک */}
          <section className="dashboard-section">
            <h2>⏰ ساعات پرترافیک (۳۰ روز اخیر)</h2>
            <div className="chart-card">
              <div className="peak-hours">
                {stats.peakHours.map((hour) => {
                  const height =
                    maxPeakHour > 0 ? (hour.orders / maxPeakHour) * 100 : 0
                  return (
                    <div key={hour.hour} className="peak-hour-col">
                      <div className="peak-hour-value">
                        {hour.orders > 0 ? formatPrice(hour.orders) : ''}
                      </div>
                      <div className="peak-hour-bar-wrapper">
                        <div
                          className="peak-hour-bar"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                      </div>
                      <div className="peak-hour-label">{hour.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* پرفروش‌ترین محصولات */}
          <section className="dashboard-section">
            <h2>⭐ پرفروش‌ترین محصولات (۳۰ روز اخیر)</h2>
            {stats.topProducts.length === 0 ? (
              <div className="admin-card">
                <p className="empty-admin">هنوز فروشی ثبت نشده است.</p>
              </div>
            ) : (
              <div className="top-products-list">
                {stats.topProducts.map((product, idx) => (
                  <div key={product.name} className="top-product-item">
                    <div className="top-product-rank">
                      #{formatPrice(idx + 1)}
                    </div>
                    <div className="top-product-info">
                      <strong>{product.name}</strong>
                      <small>
                        {formatPrice(product.count)} عدد فروش ·{' '}
                        {formatPrice(product.revenue)} تومان
                      </small>
                    </div>
                    <div className="top-product-bar">
                      <div
                        className="top-product-bar-fill"
                        style={{
                          width: `${
                            (product.count / stats.topProducts[0].count) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* 🔗 میان‌برهای مجازِ همین نقش — پچ ۶۷: فیلتر با گارد دسترسی */}
      {quickLinks.length > 0 && (
        <section className="dashboard-section">
          <h2>🔗 دسترسی سریع</h2>
          <div className="quick-links-grid">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="quick-link-card"
              >
                <div className="quick-link-icon">{item.icon}</div>
                <div>
                  <strong>{item.label}</strong>
                  <small>رفتن به بخش {item.label}</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 🧹 پاکسازی سفارش‌های قدیمی — فقط مالک */}
      {isOwner && (
        <section className="dashboard-section">
          <h2>🧹 نگهداری دیتابیس</h2>
          <CleanupOrdersCard />
        </section>
      )}
    </div>
  )
}
