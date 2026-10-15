// app/admin/page.tsx
import Link from 'next/link'
import { getOrderStats } from '@/lib/stats'
import CleanupOrdersCard from './components/CleanupOrdersCard'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

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
  const stats = await getOrderStats()

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
      {/* خوش‌آمد */}
      <div className="dashboard-welcome">
        <h1>👋 خوش آمدی</h1>
        <p>خلاصه عملکرد کافه پارک در یک نگاه</p>
      </div>

      {/* کارت‌های آمار */}
      <section className="dashboard-section">
        <h2>📊 آمار فروش</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e5f0e6' }}>
              🛒
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {formatPrice(stats.today.orders)}
              </div>
              <div className="stat-label">سفارش امروز</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#eee6d9' }}>
              💰
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {formatPrice(stats.today.revenue)}
              </div>
              <div className="stat-label">فروش امروز (تومان)</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#f0e6f0' }}>
              📅
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {formatPrice(stats.week.orders)}
              </div>
              <div className="stat-label">سفارش این هفته</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e6ecf0' }}>
              📈
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {formatPrice(stats.week.revenue)}
              </div>
              <div className="stat-label">فروش این هفته (تومان)</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#f0eee6' }}>
              🗓️
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {formatPrice(stats.month.orders)}
              </div>
              <div className="stat-label">سفارش این ماه</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e6f0e5' }}>
              💵
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {formatPrice(stats.month.revenue)}
              </div>
              <div className="stat-label">فروش این ماه (تومان)</div>
            </div>
          </div>
        </div>
      </section>

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

      {/* نمودار فروش ۷ روز اخیر */}
      <section className="dashboard-section">
        <h2>📉 فروش ۷ روز اخیر</h2>
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

      {/* دسترسی سریع */}
      <section className="dashboard-section">
        <h2>🔗 دسترسی سریع</h2>
        <div className="quick-links-grid">
          <Link href="/admin/orders" className="quick-link-card">
            <div className="quick-link-icon">🛒</div>
            <div>
              <strong>سفارش‌ها</strong>
              <small>مدیریت سفارش‌های در جریان</small>
            </div>
          </Link>

          <Link href="/admin/products" className="quick-link-card">
            <div className="quick-link-icon">🍽️</div>
            <div>
              <strong>محصولات</strong>
              <small>افزودن و ویرایش منو</small>
            </div>
          </Link>

          <Link href="/admin/categories" className="quick-link-card">
            <div className="quick-link-icon">📂</div>
            <div>
              <strong>دسته‌ها</strong>
              <small>دسته‌بندی محصولات</small>
            </div>
          </Link>

          <Link href="/admin/tables" className="quick-link-card">
            <div className="quick-link-icon">🪑</div>
            <div>
              <strong>میزها</strong>
              <small>QR Code برای هر میز</small>
            </div>
          </Link>

          <Link href="/admin/coupons" className="quick-link-card">
            <div className="quick-link-icon">🎟️</div>
            <div>
              <strong>کد تخفیف</strong>
              <small>مدیریت کوپن‌ها</small>
            </div>
          </Link>

          <Link href="/admin/settings" className="quick-link-card">
            <div className="quick-link-icon">⚙️</div>
            <div>
              <strong>تنظیمات</strong>
              <small>اطلاعات کافه و ظاهر</small>
            </div>
          </Link>
        </div>
      </section>

      {/* 🧹 پاکسازی سفارش‌های قدیمی */}
      <section className="dashboard-section">
        <h2>🧹 نگهداری دیتابیس</h2>
        <CleanupOrdersCard />
      </section>
    </div>
  )
}