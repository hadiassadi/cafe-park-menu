// app/admin/reports/sales/SalesReportsManager.tsx

'use client'

import { useEffect, useState } from 'react'
import type { SalesReportData, SalesReportFilter } from '@/lib/stats'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

const FILTER_LABELS: Record<SalesReportFilter, string> = {
  today: 'امروز',
  week: 'این هفته',
  month: 'این ماه',
  last_month: 'ماه قبل',
  quarter: '۳ ماه اخیر',
  all: 'همه',
}

type ViewType = 'daily' | 'products' | 'categories'

const VIEW_LABELS: Record<ViewType, string> = {
  daily: '📅 روزانه',
  products: '📦 محصولات',
  categories: '📂 دسته‌بندی',
}

export default function SalesReportsManager() {
  const [filter, setFilter] = useState<SalesReportFilter>('month')
  const [view, setView] = useState<ViewType>('daily')
  const [data, setData] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/reports/sales?filter=${filter}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((result: SalesReportData) => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filter])

  async function handleDownload(type: ViewType | 'summary') {
    setDownloading(true)
    try {
      const res = await fetch(
        `/api/export/sales?type=${type}&filter=${filter}`
      )
      if (!res.ok) throw new Error('خطا در دانلود')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        res.headers
          .get('Content-Disposition')
          ?.split('filename="')[1]
          ?.replace('"', '') || 'sales-report.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('خطا در دانلود گزارش')
    }
    setDownloading(false)
  }

  return (
    <div className="admin-main">
      <div className="admin-header">
        <div>
          <h1>📊 گزارش فروش و مالیات</h1>
          <p className="admin-subtitle">
            گزارش‌های مالی برای حسابداری و مالیات — قابل دانلود در قالب CSV
          </p>
        </div>
        <div className="report-export-actions">
          <button
            type="button"
            className="btn"
            onClick={() => handleDownload('summary')}
            disabled={downloading || loading}
          >
            📥 خلاصه
          </button>
          <button
            type="button"
            className="btn primary-btn"
            onClick={() => handleDownload(view)}
            disabled={downloading || loading}
          >
            📥 دانلود {VIEW_LABELS[view]}
          </button>
        </div>
      </div>

      <div
        className="toolbar"
        style={{
          padding: '0 0 16px 0',
          background: 'transparent',
          borderBottom: 'none',
          position: 'static',
        }}
      >
        {(Object.keys(FILTER_LABELS) as SalesReportFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-card">
          <p className="empty-admin">⏳ در حال بارگذاری گزارش...</p>
        </div>
      ) : !data ? (
        <div className="admin-card">
          <p className="empty-admin">خطا در بارگذاری گزارش</p>
        </div>
      ) : (
        <>
          <section className="dashboard-section">
            <h2>📈 خلاصه {data.summary.period_label}</h2>
            <div className="sales-summary-grid">
              <div className="sales-summary-card primary">
                <div className="sales-summary-icon">💰</div>
                <div className="sales-summary-content">
                  <div className="sales-summary-value">
                    {formatPrice(data.summary.total_revenue)}
                  </div>
                  <div className="sales-summary-label">
                    کل فروش (تومان)
                  </div>
                </div>
              </div>

              <div className="sales-summary-card">
                <div className="sales-summary-icon">📦</div>
                <div className="sales-summary-content">
                  <div className="sales-summary-value">
                    {formatPrice(data.summary.total_orders)}
                  </div>
                  <div className="sales-summary-label">تعداد سفارش</div>
                </div>
              </div>

              <div className="sales-summary-card">
                <div className="sales-summary-icon">📊</div>
                <div className="sales-summary-content">
                  <div className="sales-summary-value">
                    {formatPrice(data.summary.avg_order_value)}
                  </div>
                  <div className="sales-summary-label">
                    میانگین هر سفارش
                  </div>
                </div>
              </div>

              <div className="sales-summary-card">
                <div className="sales-summary-icon">🎟️</div>
                <div className="sales-summary-content">
                  <div className="sales-summary-value">
                    {formatPrice(data.summary.total_discount)}
                  </div>
                  <div className="sales-summary-label">
                    کل تخفیف (تومان)
                  </div>
                </div>
              </div>

              {data.summary.cancelled_count > 0 && (
                <div className="sales-summary-card danger">
                  <div className="sales-summary-icon">🚫</div>
                  <div className="sales-summary-content">
                    <div className="sales-summary-value">
                      {formatPrice(data.summary.cancelled_count)}
                    </div>
                    <div className="sales-summary-label">
                      لغو شده ({formatPrice(data.summary.cancelled_amount)}{' '}
                      تومان)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="sales-view-tabs">
            {(Object.keys(VIEW_LABELS) as ViewType[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`sales-view-tab ${view === v ? 'active' : ''}`}
                onClick={() => setView(v)}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          <section className="dashboard-section">
            {view === 'daily' && (
              <>
                {data.daily.length === 0 ? (
                  <div className="admin-card">
                    <p className="empty-admin">
                      در این بازه سفارشی ثبت نشده است.
                    </p>
                  </div>
                ) : (
                  <div className="sales-table-wrapper">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>تاریخ</th>
                          <th>تعداد سفارش</th>
                          <th>فروش (تومان)</th>
                          <th>تخفیف</th>
                          <th>میانگین</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map((d) => (
                          <tr key={d.date}>
                            <td>
                              {/* ✅ تاریخ میلادی حذف شد و فقط لیبل فارسی ماند */}
                              <strong>{d.label}</strong>
                            </td>
                            <td className="sales-table-num">
                              {formatPrice(d.orders)}
                            </td>
                            <td className="sales-table-amount">
                              {formatPrice(d.revenue)}
                            </td>
                            <td className="sales-table-discount">
                              {d.discount > 0
                                ? `− ${formatPrice(d.discount)}`
                                : '—'}
                            </td>
                            <td className="sales-table-num">
                              {formatPrice(d.avg)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>
                            <strong>جمع کل</strong>
                          </td>
                          <td className="sales-table-num">
                            <strong>
                              {formatPrice(data.summary.total_orders)}
                            </strong>
                          </td>
                          <td className="sales-table-amount">
                            <strong>
                              {formatPrice(data.summary.total_revenue)}
                            </strong>
                          </td>
                          <td className="sales-table-discount">
                            <strong>
                              {data.summary.total_discount > 0
                                ? `− ${formatPrice(data.summary.total_discount)}`
                                : '—'}
                            </strong>
                          </td>
                          <td className="sales-table-num">
                            <strong>
                              {formatPrice(data.summary.avg_order_value)}
                            </strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}

            {view === 'products' && (
              <>
                {data.products.length === 0 ? (
                  <div className="admin-card">
                    <p className="empty-admin">
                      در این بازه محصولی فروش نرفته است.
                    </p>
                  </div>
                ) : (
                  <div className="sales-table-wrapper">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>محصول</th>
                          <th>تعداد فروش</th>
                          <th>درآمد (تومان)</th>
                          <th>سهم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.products.map((p, idx) => (
                          <tr key={p.product_name}>
                            <td className="sales-table-rank">
                              #{formatPrice(idx + 1)}
                            </td>
                            <td>
                              <strong>{p.product_name}</strong>
                            </td>
                            <td className="sales-table-num">
                              {formatPrice(p.quantity)}
                            </td>
                            <td className="sales-table-amount">
                              {formatPrice(p.revenue)}
                            </td>
                            <td className="sales-table-percent">
                              <div className="sales-bar-mini">
                                <div
                                  className="sales-bar-mini-fill"
                                  style={{ width: `${p.percentage}%` }}
                                />
                              </div>
                              <small>
                                {p.percentage.toLocaleString('fa-IR')}٪
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {view === 'categories' && (
              <>
                {data.categories.length === 0 ? (
                  <div className="admin-card">
                    <p className="empty-admin">
                      در این بازه دسته‌ای فروش نرفته است.
                    </p>
                  </div>
                ) : (
                  <div className="sales-table-wrapper">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>دسته‌بندی</th>
                          <th>تعداد آیتم</th>
                          <th>درآمد (تومان)</th>
                          <th>سهم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.categories.map((c, idx) => (
                          <tr key={c.category_name}>
                            <td className="sales-table-rank">
                              #{formatPrice(idx + 1)}
                            </td>
                            <td>
                              <span className="sales-cat-icon">
                                {c.category_icon || '📂'}
                              </span>
                              <strong>{c.category_name}</strong>
                            </td>
                            <td className="sales-table-num">
                              {formatPrice(c.quantity)}
                            </td>
                            <td className="sales-table-amount">
                              {formatPrice(c.revenue)}
                            </td>
                            <td className="sales-table-percent">
                              <div className="sales-bar-mini">
                                <div
                                  className="sales-bar-mini-fill"
                                  style={{ width: `${c.percentage}%` }}
                                />
                              </div>
                              <small>
                                {c.percentage.toLocaleString('fa-IR')}٪
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="sales-report-hint">
            💡 <strong>نکته:</strong> خروجی CSV با BOM ذخیره می‌شه و در
            Excel فارسی بدون مشکل باز می‌شه. برای دیدن ریز سفارش‌ها، از
            «خروجی Excel سفارش‌ها» در صفحه سفارش‌ها استفاده کن.
          </div>
        </>
      )}
    </div>
  )
}