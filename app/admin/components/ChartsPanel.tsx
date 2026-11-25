'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChartStats } from '@/lib/dashboard-stats'

// 🎯 پچ ۷۱ — تب «نمودارها» به‌صورت on-demand
//   این پنل فقط وقتی تب باز شود mount می‌شود، آن‌وقت داده را از API می‌گیرد؛
//   لود اولیهٔ داشبورد دیگر منتظر شش ماه داده نمی‌ماند.
//   کلاس‌های CSS همان admin-dashboard.css هستند تا ظاهر یکدست بماند.

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

function ChangeBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span className="change-badge neutral">−</span>
  }
  const isPositive = value > 0
  return (
    <span className={`change-badge ${isPositive ? 'positive' : 'negative'}`}>
      {isPositive ? '↑' : '↓'} {Math.abs(value).toLocaleString('fa-IR')}٪
    </span>
  )
}

export default function ChartsPanel() {
  const [charts, setCharts] = useState<ChartStats | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'done'>('loading')

  const load = useCallback(() => {
    setState('loading')
    fetch('/api/admin/dashboard/stats?part=charts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.charts) {
          setCharts(d.charts as ChartStats)
          setState('done')
        } else {
          setState('error')
        }
      })
      .catch(() => setState('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state === 'loading') {
    return (
      <section className="dashboard-section" aria-busy="true">
        <div className="skel-card" />
        <div className="skel-card" />
        <div className="skel-card" />
      </section>
    )
  }

  if (state === 'error' || !charts) {
    return (
      <section className="dashboard-section">
        <h2>📈 نمودارها</h2>
        <div className="admin-card">
          <p className="empty-admin">
            خطا در بارگذاری نمودارها —{' '}
            <button type="button" onClick={load} className="dash-retry-btn">
              دوباره تلاش کن
            </button>
          </p>
        </div>
      </section>
    )
  }

  const maxRevenue = Math.max(...charts.dailyRevenue.map((d) => d.revenue), 1)
  const maxMonthlyRevenue = Math.max(
    ...charts.monthlyRevenue.map((m) => m.revenue),
    1
  )
  const maxPeakHour = Math.max(...charts.peakHours.map((h) => h.orders), 1)

  return (
    <>
      <section className="dashboard-section">
        <h2>📊 مقایسه با ماه قبل</h2>
        <div className="comparison-grid">
          <div className="comparison-card">
            <div className="comparison-header">
              <span className="comparison-label">💰 فروش</span>
              <ChangeBadge value={charts.comparison.revenueChange} />
            </div>
            <div className="comparison-value">
              {formatPrice(charts.month.revenue)}
              <small>تومان</small>
            </div>
          </div>

          <div className="comparison-card">
            <div className="comparison-header">
              <span className="comparison-label">🛒 سفارش</span>
              <ChangeBadge value={charts.comparison.ordersChange} />
            </div>
            <div className="comparison-value">
              {formatPrice(charts.month.orders)}
              <small>سفارش</small>
            </div>
          </div>

          <div className="comparison-card">
            <div className="comparison-header">
              <span className="comparison-label">📈 میانگین هر سفارش</span>
              <ChangeBadge value={charts.comparison.avgOrderChange} />
            </div>
            <div className="comparison-value">
              {formatPrice(charts.avgOrderValue)}
              <small>تومان</small>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>
          📉 فروش ۷ روز اخیر
          <small className="dash-section-note">
            مجموع این هفته:{' '}
            {formatPrice(
              charts.dailyRevenue.reduce((s, d) => s + d.revenue, 0)
            )}{' '}
            تومان
          </small>
        </h2>
        <div className="chart-card">
          <div className="chart-bars">
            {charts.dailyRevenue.map((day) => (
              <div key={day.date} className="chart-col">
                <div className="chart-col-value">
                  {day.revenue > 0 ? formatPrice(day.revenue) : ''}
                </div>
                <div className="chart-bar-wrapper">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${Math.max(
                        maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0,
                        2
                      )}%`,
                    }}
                  />
                </div>
                <div className="chart-col-label">{day.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>📊 فروش ۶ ماه اخیر</h2>
        <div className="chart-card">
          <div className="chart-bars">
            {charts.monthlyRevenue.map((month) => (
              <div key={month.month} className="chart-col">
                <div className="chart-col-value">
                  {month.revenue > 0 ? formatPrice(month.revenue) : ''}
                </div>
                <div className="chart-bar-wrapper">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${Math.max(
                        maxMonthlyRevenue > 0
                          ? (month.revenue / maxMonthlyRevenue) * 100
                          : 0,
                        2
                      )}%`,
                    }}
                  />
                </div>
                <div className="chart-col-label">{month.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>⏰ ساعات پرترافیک (۳۰ روز اخیر)</h2>
        <div className="chart-card">
          <div className="peak-hours">
            {charts.peakHours.map((hour) => (
              <div key={hour.hour} className="peak-hour-col">
                <div className="peak-hour-value">
                  {hour.orders > 0 ? formatPrice(hour.orders) : ''}
                </div>
                <div className="peak-hour-bar-wrapper">
                  <div
                    className="peak-hour-bar"
                    style={{
                      height: `${Math.max(
                        maxPeakHour > 0 ? (hour.orders / maxPeakHour) * 100 : 0,
                        2
                      )}%`,
                    }}
                  />
                </div>
                <div className="peak-hour-label">{hour.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
