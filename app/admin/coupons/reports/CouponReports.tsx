'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { CouponReportData } from '@/lib/stats'
import PrintInvoice, {
  type PrintableOrder,
} from '@/app/admin/components/PrintInvoice'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

type TimeFilter = 'today' | 'week' | 'month' | 'all'

const FILTER_LABELS: Record<TimeFilter, string> = {
  today: 'امروز',
  week: 'این هفته',
  month: 'این ماه',
  all: 'همه',
}

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
  discount_amount?: number
}

type OrderDetail = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  table_number: number | null
  note: string | null
  items: OrderItem[]
  subtotal: number
  original_subtotal: number | null
  coupon_discount: number
  status: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'جدید',
  confirmed: 'تأیید شده',
  preparing: 'آماده‌سازی',
  ready: 'آماده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
}

export default function CouponReports() {
  const [filter, setFilter] = useState<TimeFilter>('month')
  const [data, setData] = useState<CouponReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [printOrder, setPrintOrder] = useState<PrintableOrder | null>(null)
  const [mounted, setMounted] = useState(false)

  // ✅ برای Portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // ✅ لود آمار کوپن‌ها
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/coupons/stats?filter=${filter}`)
      .then((res) => res.json())
      .then((result: CouponReportData) => {
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

  // ✅ لود سفارش‌های کوپن انتخاب‌شده
  useEffect(() => {
    if (!selectedCode) {
      setOrders([])
      return
    }

    let cancelled = false
    setLoadingOrders(true)

    fetch(`/api/coupons/orders?code=${selectedCode}&filter=${filter}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          setOrders(result.orders || [])
          setLoadingOrders(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoadingOrders(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCode, filter])

  // ✅ تریگر پرینت
  useEffect(() => {
    if (!printOrder) return

    const handleAfterPrint = () => {
      setPrintOrder(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    const timer = setTimeout(() => {
      window.print()
    }, 400)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printOrder])

  // ✅ بالاترین تخفیف برای bar chart
  const maxDiscount = data?.stats.length
    ? Math.max(...data.stats.map((s) => s.total_discount))
    : 1

  // ✅ فیلتر جستجو
  const filteredStats = (data?.stats ?? []).filter((stat) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      stat.code.toLowerCase().includes(q) ||
      (stat.description ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="admin-main">
      {/* هدر */}
      <div className="admin-header">
        <div>
          <h1>📊 گزارش کوپن‌ها</h1>
          <p className="admin-subtitle">
            عملکرد کدهای تخفیف در بازه انتخاب‌شده
          </p>
        </div>
        <Link href="/admin/coupons" className="btn">
          ← بازگشت به کوپن‌ها
        </Link>
      </div>

      {/* فیلترها */}
      <div
        className="toolbar"
        style={{
          padding: '0 0 16px 0',
          background: 'transparent',
          borderBottom: 'none',
          position: 'static',
        }}
      >
        {(Object.keys(FILTER_LABELS) as TimeFilter[]).map((f) => (
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
      ) : !data || data.stats.length === 0 ? (
        <div className="admin-card">
          <p className="empty-admin">
            در بازه «{FILTER_LABELS[filter]}» هیچ سفارشی با کوپن ثبت نشده است.
          </p>
        </div>
      ) : (
        <>
          {/* ─── کارت‌های خلاصه ─── */}
          <section className="dashboard-section">
            <div className="coupon-report-summary">
              <div className="coupon-report-stat">
                <div
                  className="coupon-report-stat-icon"
                  style={{ background: '#e5f0e6' }}
                >
                  🛒
                </div>
                <div>
                  <div className="coupon-report-stat-value">
                    {formatPrice(data.summary.total_orders_with_coupon)}
                  </div>
                  <div className="coupon-report-stat-label">
                    سفارش با کوپن
                  </div>
                </div>
              </div>

              <div className="coupon-report-stat">
                <div
                  className="coupon-report-stat-icon"
                  style={{ background: '#fde8e6' }}
                >
                  🎟️
                </div>
                <div>
                  <div className="coupon-report-stat-value">
                    {formatPrice(data.summary.total_discount_given)}
                  </div>
                  <div className="coupon-report-stat-label">
                    تخفیف کل (تومان)
                  </div>
                </div>
              </div>

              <div className="coupon-report-stat">
                <div
                  className="coupon-report-stat-icon"
                  style={{ background: '#eee6d9' }}
                >
                  💰
                </div>
                <div>
                  <div className="coupon-report-stat-value">
                    {formatPrice(data.summary.total_revenue_with_coupon)}
                  </div>
                  <div className="coupon-report-stat-label">
                    فروش با کوپن (تومان)
                  </div>
                </div>
              </div>

              <div className="coupon-report-stat">
                <div
                  className="coupon-report-stat-icon"
                  style={{ background: '#e6ecf0' }}
                >
                  📈
                </div>
                <div>
                  <div className="coupon-report-stat-value">
                    {formatPrice(data.summary.avg_discount_per_order)}
                  </div>
                  <div className="coupon-report-stat-label">
                    میانگین تخفیف هر سفارش
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── جدول کوپن‌ها ─── */}
          <section className="dashboard-section">
            <div className="coupon-report-table-header">
              <h2>📋 عملکرد کوپن‌ها</h2>
              <div className="coupon-report-search">
                <span>🔍</span>
                <input
                  type="search"
                  placeholder="جستجوی کد یا توضیحات..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="coupon-report-table-wrapper">
              <table className="coupon-report-table">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>تخفیف</th>
                    <th>تعداد استفاده</th>
                    <th>تخفیف کل</th>
                    <th>فروش کل</th>
                    <th>میانگین تخفیف</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: 'center',
                          padding: '30px',
                          color: '#766f64',
                        }}
                      >
                        کوپنی با این عبارت پیدا نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredStats.map((stat) => (
                      <tr
                        key={stat.code}
                        className="coupon-report-row-clickable"
                        onClick={() => setSelectedCode(stat.code)}
                      >
                        <td>
                          <span className="coupon-report-code">
                            {stat.code}
                          </span>
                          {!stat.is_active && (
                            <span className="coupon-report-inactive">
                              غیرفعال
                            </span>
                          )}
                        </td>
                        <td>
                          {stat.discount_type === 'percent'
                            ? `${stat.discount_value.toLocaleString('fa-IR')}٪`
                            : `${formatPrice(stat.discount_value)} تومان`}
                        </td>
                        <td>
                          <strong>{formatPrice(stat.used_count)}</strong>
                        </td>
                        <td className="coupon-report-discount">
                          {formatPrice(stat.total_discount)} تومان
                        </td>
                        <td className="coupon-report-revenue">
                          {formatPrice(stat.total_revenue)} تومان
                        </td>
                        <td>{formatPrice(stat.avg_discount)} تومان</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── نمودار تخفیف ─── */}
          <section className="dashboard-section">
            <h2>📉 بیشترین تخفیف داده‌شده</h2>
            <div className="coupon-chart">
              {data.stats.slice(0, 5).map((stat) => {
                const percentage = Math.min(
                  90,
                  (stat.total_discount / maxDiscount) * 90
                )
                return (
                  <div key={stat.code} className="coupon-chart-row">
                    <div className="coupon-chart-label">
                      <span className="coupon-report-code">
                        {stat.code}
                      </span>
                    </div>
                    <div className="coupon-chart-bar-wrapper">
                      <div
                        className="coupon-chart-bar"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="coupon-chart-value">
                      {formatPrice(stat.total_discount)} تومان
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* ─── Modal سفارش‌های کوپن ─── */}
      {selectedCode && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedCode(null)}
        >
          <div
            className="modal-container modal-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>سفارش‌های کوپن {selectedCode}</h2>
                <p>
                  {loadingOrders
                    ? 'در حال بارگذاری...'
                    : `${orders.length.toLocaleString('fa-IR')} سفارش در بازه «${FILTER_LABELS[filter]}»`}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedCode(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {loadingOrders ? (
                <p className="empty-admin">
                  ⏳ در حال بارگذاری سفارش‌ها...
                </p>
              ) : orders.length === 0 ? (
                <p className="empty-admin">
                  در این بازه سفارشی با این کوپن ثبت نشده است.
                </p>
              ) : (
                <div className="coupon-orders-list">
                  {orders.map((order) => {
                    const isExpanded = expandedOrderId === order.id

                    return (
                      <div key={order.id} className="coupon-order-item">
                        <div className="coupon-order-header">
                          <span className="coupon-order-number">
                            سفارش #{order.order_number}
                          </span>
                          <span
                            className={`coupon-order-status status-${order.status}`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </div>

                        <div className="coupon-order-body">
                          <div className="coupon-order-row">
                            <span>👤</span>
                            <strong>{order.customer_name}</strong>
                          </div>
                          <div className="coupon-order-row">
                            <span>📞</span>
                            <span dir="ltr">
                              {order.customer_phone}
                            </span>
                          </div>
                          {order.table_number && (
                            <div className="coupon-order-row">
                              <span>📍</span>
                              <span>میز {order.table_number}</span>
                            </div>
                          )}
                          <div className="coupon-order-row">
                            <span>🕐</span>
                            <span>
                              {new Date(order.created_at).toLocaleString(
                                'fa-IR',
                                {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }
                              )}
                            </span>
                          </div>
                        </div>

                        {/* ✅ ریز اقلام */}
                        {isExpanded && (
                          <div className="coupon-order-items">
                            <div className="coupon-order-items-title">
                              🧾 اقلام سفارش
                            </div>
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="coupon-order-item-row"
                              >
                                <span className="coupon-order-item-name">
                                  {formatPrice(item.quantity)} ×{' '}
                                  {item.product_name}
                                  {item.option_name && (
                                    <small> ({item.option_name})</small>
                                  )}
                                </span>
                                <span className="coupon-order-item-price">
                                  {formatPrice(
                                    item.unit_price * item.quantity
                                  )}{' '}
                                  تومان
                                </span>
                              </div>
                            ))}
                            {order.note && (
                              <div className="coupon-order-note">
                                📝 {order.note}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="coupon-order-pricing">
                          <div className="coupon-order-price-row">
                            <span>جمع اصلی:</span>
                            <span>
                              {formatPrice(
                                order.original_subtotal ??
                                  order.subtotal
                              )}{' '}
                              تومان
                            </span>
                          </div>
                          <div className="coupon-order-price-row discount">
                            <span>🎟️ تخفیف:</span>
                            <span>
                              − {formatPrice(order.coupon_discount)} تومان
                            </span>
                          </div>
                          <div className="coupon-order-price-row total">
                            <span>پرداخت:</span>
                            <strong>
                              {formatPrice(order.subtotal)} تومان
                            </strong>
                          </div>
                        </div>

                        {/* ✅ دکمه‌های اقدام */}
                        <div className="coupon-order-actions">
                          <button
                            type="button"
                            className="coupon-order-action-btn"
                            onClick={() =>
                              setExpandedOrderId(
                                isExpanded ? null : order.id
                              )
                            }
                          >
                            {isExpanded
                              ? '▲ بستن جزئیات'
                              : '▼ مشاهده اقلام'}
                          </button>
                          <button
                            type="button"
                            className="coupon-order-action-btn primary"
                            onClick={() =>
                              setPrintOrder(order as PrintableOrder)
                            }
                          >
                            🖨️ پرینت
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedCode(null)}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ فاکتور چاپی — با Portal */}
      {mounted &&
        printOrder &&
        createPortal(<PrintInvoice order={printOrder} />, document.body)}
    </div>
  )
}