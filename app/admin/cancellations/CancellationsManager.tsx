'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { CancellationStats } from '@/lib/stats'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

type TimeFilter = 'today' | 'week' | 'month' | 'all'

const FILTER_LABELS: Record<TimeFilter, string> = {
  today: 'امروز',
  week: 'این هفته',
  month: 'این ماه',
  all: 'همه',
}

type CancelledOrder = CancellationStats['recentCancellations'][0]

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function CancellationsManager() {
  const [filter, setFilter] = useState<TimeFilter>('month')
  const [data, setData] = useState<CancellationStats | null>(null)
  const [loading, setLoading] = useState(true)

  // ✅ State های مودال جزئیات
  const [selectedOrder, setSelectedOrder] = useState<CancelledOrder | null>(
    null
  )
  const [printOrder, setPrintOrder] = useState<CancelledOrder | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/cancellations/stats?filter=${filter}`)
      .then((res) => res.json())
      .then((result: CancellationStats) => {
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

  // ✅ چاپ فاکتور
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

  const maxDailyCount = data?.dailyCancellations.length
    ? Math.max(...data.dailyCancellations.map((d) => d.count), 1)
    : 1

  return (
    <div className="admin-main">
      {/* هدر */}
      <div className="admin-header">
        <div>
          <h1>📊 آمار لغو سفارش‌ها</h1>
          <p className="admin-subtitle">
            تحلیل دلایل لغو و روند آن در بازه انتخاب‌شده
          </p>
        </div>
        <Link href="/admin/cancellation-reasons" className="btn">
          ⚙️ مدیریت دلایل
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
          <p className="empty-admin">⏳ در حال بارگذاری آمار...</p>
        </div>
      ) : !data ? (
        <div className="admin-card">
          <p className="empty-admin">خطا در بارگذاری آمار</p>
        </div>
      ) : (
        <>
          {/* کارت‌های خلاصه */}
          <section className="dashboard-section">
            <div className="cancellation-summary-grid">
              <div className="cancellation-summary-card">
                <div
                  className="cancellation-summary-icon"
                  style={{ background: '#fde8e6' }}
                >
                  🚫
                </div>
                <div>
                  <div className="cancellation-summary-value">
                    {formatPrice(data.summary.total)}
                  </div>
                  <div className="cancellation-summary-label">کل لغوها</div>
                </div>
              </div>

              <div className="cancellation-summary-card">
                <div
                  className="cancellation-summary-icon"
                  style={{ background: '#e6ecf0' }}
                >
                  👤
                </div>
                <div>
                  <div className="cancellation-summary-value">
                    {formatPrice(data.summary.by_customer)}
                  </div>
                  <div className="cancellation-summary-label">توسط مشتری</div>
                </div>
              </div>

              <div className="cancellation-summary-card">
                <div
                  className="cancellation-summary-icon"
                  style={{ background: '#f0e6f0' }}
                >
                  🛠️
                </div>
                <div>
                  <div className="cancellation-summary-value">
                    {formatPrice(data.summary.by_admin)}
                  </div>
                  <div className="cancellation-summary-label">توسط کافه</div>
                </div>
              </div>

              <div className="cancellation-summary-card">
                <div
                  className="cancellation-summary-icon"
                  style={{ background: '#eee6d9' }}
                >
                  📈
                </div>
                <div>
                  <div className="cancellation-summary-value">
                    {data.summary.cancel_rate.toLocaleString('fa-IR')}٪
                  </div>
                  <div className="cancellation-summary-label">
                    نرخ لغو (از {formatPrice(data.summary.total_orders)}{' '}
                    سفارش)
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* دلایل پرتکرار */}
          <section className="dashboard-section">
            <h2>🎯 پرتکرارترین دلایل لغو</h2>
            {data.topReasons.length === 0 ? (
              <div className="admin-card">
                <p className="empty-admin">
                  در این بازه، لغوی با دلیل ثبت نشده است.
                </p>
              </div>
            ) : (
              <div className="cancellation-reasons-chart">
                {data.topReasons.map((reason, idx) => (
                  <div key={reason.reason} className="cancellation-chart-row">
                    <div className="cancellation-chart-rank">
                      #{formatPrice(idx + 1)}
                    </div>
                    <div className="cancellation-chart-icon">
                      {reason.icon || '📝'}
                    </div>
                    <div className="cancellation-chart-info">
                      <div className="cancellation-chart-label">
                        {reason.reason}
                      </div>
                      <div className="cancellation-chart-bar-wrapper">
                        <div
                          className="cancellation-chart-bar"
                          style={{ width: `${reason.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="cancellation-chart-stats">
                      <strong>{formatPrice(reason.count)}</strong>
                      <small>
                        {reason.percentage.toLocaleString('fa-IR')}٪
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* نمودار روزانه */}
          <section className="dashboard-section">
            <h2>📉 لغوها در ۷ روز اخیر</h2>
            <div className="chart-card">
              <div className="chart-bars">
                {data.dailyCancellations.map((day) => {
                  const height =
                    maxDailyCount > 0
                      ? (day.count / maxDailyCount) * 100
                      : 0
                  return (
                    <div key={day.date} className="chart-col">
                      <div className="chart-col-value">
                        {day.count > 0 ? formatPrice(day.count) : ''}
                      </div>
                      <div className="chart-bar-wrapper">
                        <div
                          className="chart-bar"
                          style={{
                            height: `${Math.max(height, 2)}%`,
                            background:
                              'linear-gradient(180deg, #d97a6c 0%, #9b3c32 100%)',
                          }}
                        />
                      </div>
                      <div className="chart-col-label">{day.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* جدول لغوهای اخیر */}
          <section className="dashboard-section">
            <h2>📋 لغوهای اخیر</h2>
            {data.recentCancellations.length === 0 ? (
              <div className="admin-card">
                <p className="empty-admin">لغوی ثبت نشده است.</p>
              </div>
            ) : (
              <div className="cancellation-table-wrapper">
                <table className="cancellation-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>مشتری</th>
                      <th>مبلغ</th>
                      <th>دلیل</th>
                      <th>لغو کننده</th>
                      <th>تاریخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCancellations.map((order) => (
                      <tr
                        key={order.id}
                        className="cancellation-row-clickable"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td>
                          <span className="cancellation-order-num">
                            #{formatPrice(order.order_number)}
                          </span>
                        </td>
                        <td>
                          <strong>{order.customer_name}</strong>
                          <small dir="ltr">{order.customer_phone}</small>
                        </td>
                        <td className="cancellation-amount">
                          {formatPrice(order.subtotal)} تومان
                        </td>
                        <td>
                          {order.cancellation_reason_label ? (
                            <span className="cancellation-reason-badge">
                              {order.cancellation_reason_label}
                            </span>
                          ) : (
                            <span className="cancellation-no-reason">
                              بدون دلیل
                            </span>
                          )}
                        </td>
                        <td>
                          {order.cancelled_by === 'customer' ? (
                            <span className="cancellation-by by-customer">
                              👤 مشتری
                            </span>
                          ) : order.cancelled_by === 'admin' ? (
                            <span className="cancellation-by by-admin">
                              🛠️ کافه
                            </span>
                          ) : (
                            <span className="cancellation-by">—</span>
                          )}
                        </td>
                        <td className="cancellation-date">
                          {formatDateTime(order.cancelled_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ─── Modal جزئیات سفارش لغو شده ─── */}
      {selectedOrder && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="modal-container modal-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>سفارش #{formatPrice(selectedOrder.order_number)}</h2>
                <p style={{ color: '#9b3c32', fontWeight: 700 }}>
                  ❌ لغو شده
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* اطلاعات لغو */}
              <div className="cancellation-info-box" style={{ marginTop: 0 }}>
                <div className="cancellation-info-label">
                  {selectedOrder.cancellation_reason_label || 'بدون دلیل مشخص'}
                </div>
                {selectedOrder.cancellation_note && (
                  <div className="cancellation-info-note">
                    📝 {selectedOrder.cancellation_note}
                  </div>
                )}
                <div className="cancellation-info-by">
                  {selectedOrder.cancelled_by === 'customer'
                    ? '👤 لغو شده توسط مشتری'
                    : selectedOrder.cancelled_by === 'admin'
                      ? '🛠️ لغو شده توسط کافه'
                      : 'لغو شده'}
                  {' · '}
                  {formatDateTime(selectedOrder.cancelled_at)}
                </div>
              </div>

              {/* اطلاعات مشتری */}
              <div className="info-card" style={{ marginTop: '16px' }}>
                <h3>👤 اطلاعات مشتری</h3>
                <div className="info-row">
                  <span>نام:</span>
                  <strong>{selectedOrder.customer_name}</strong>
                </div>
                <div className="info-row">
                  <span>شماره:</span>
                  <strong dir="ltr">{selectedOrder.customer_phone}</strong>
                </div>
                {selectedOrder.table_number && (
                  <div className="info-row">
                    <span>میز:</span>
                    <strong>{formatPrice(selectedOrder.table_number)}</strong>
                  </div>
                )}
                {selectedOrder.note && (
                  <div className="info-row">
                    <span>توضیحات مشتری:</span>
                    <strong>{selectedOrder.note}</strong>
                  </div>
                )}
              </div>

              {/* اقلام */}
              <div className="info-card" style={{ marginTop: '16px' }}>
                <h3>🧾 اقلام سفارش</h3>
                {selectedOrder.items.length === 0 ? (
                  <p className="empty-admin">اقلام در دسترس نیست.</p>
                ) : (
                  <>
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="info-row">
                        <span>
                          {formatPrice(item.quantity)} × {item.product_name}
                          {item.option_name && (
                            <small> ({item.option_name})</small>
                          )}
                        </span>
                        <strong>
                          {formatPrice(item.unit_price * item.quantity)}
                        </strong>
                      </div>
                    ))}

                    {selectedOrder.coupon_code &&
                    selectedOrder.coupon_discount ? (
                      <>
                        <div className="info-row" style={{ marginTop: '10px' }}>
                          <span>جمع اقلام:</span>
                          <strong>
                            {formatPrice(
                              selectedOrder.original_subtotal ??
                                selectedOrder.subtotal
                            )}{' '}
                            تومان
                          </strong>
                        </div>
                        <div className="info-row discount">
                          <span>
                            🎟️ تخفیف ({selectedOrder.coupon_code}):
                          </span>
                          <strong>
                            − {formatPrice(selectedOrder.coupon_discount)}{' '}
                            تومان
                          </strong>
                        </div>
                        <div className="total-row">
                          <span>قابل پرداخت</span>
                          <span>
                            {formatPrice(selectedOrder.subtotal)} تومان
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="total-row">
                        <span>جمع کل</span>
                        <span>
                          {formatPrice(selectedOrder.subtotal)} تومان
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedOrder(null)}
              >
                بستن
              </button>
              <button
                type="button"
                className="btn primary-btn"
                onClick={() => setPrintOrder(selectedOrder)}
              >
                🖨️ پرینت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── فاکتور چاپی ─── */}
      {mounted &&
        printOrder &&
        createPortal(
          <div className="print-invoice">
            <div className="print-invoice-header">
              <h1 className="print-invoice-title">کافه پارک</h1>
              <p className="print-invoice-subtitle">
                فاکتور سفارش (لغو شده)
              </p>
            </div>

            <div className="print-invoice-meta">
              <div className="print-invoice-meta-row">
                <span>شماره سفارش:</span>
                <strong>#{formatPrice(printOrder.order_number)}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>وضعیت:</span>
                <strong style={{ color: '#9b3c32' }}>❌ لغو شده</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>تاریخ لغو:</span>
                <strong>{formatDateTime(printOrder.cancelled_at)}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>لغو کننده:</span>
                <strong>
                  {printOrder.cancelled_by === 'customer'
                    ? 'مشتری'
                    : printOrder.cancelled_by === 'admin'
                      ? 'کافه'
                      : '—'}
                </strong>
              </div>
            </div>

            {printOrder.cancellation_reason_label && (
              <div className="print-invoice-customer">
                <h3>دلیل لغو</h3>
                <div className="print-invoice-meta-row">
                  <span>دلیل:</span>
                  <strong>{printOrder.cancellation_reason_label}</strong>
                </div>
                {printOrder.cancellation_note && (
                  <div className="print-invoice-meta-row">
                    <span>توضیحات:</span>
                    <strong>{printOrder.cancellation_note}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="print-invoice-customer">
              <h3>اطلاعات مشتری</h3>
              <div className="print-invoice-meta-row">
                <span>نام:</span>
                <strong>{printOrder.customer_name}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>شماره تماس:</span>
                <strong dir="ltr">{printOrder.customer_phone}</strong>
              </div>
              {printOrder.table_number && (
                <div className="print-invoice-meta-row">
                  <span>شماره میز:</span>
                  <strong>{formatPrice(printOrder.table_number)}</strong>
                </div>
              )}
              {printOrder.note && (
                <div className="print-invoice-meta-row">
                  <span>توضیحات مشتری:</span>
                  <strong>{printOrder.note}</strong>
                </div>
              )}
            </div>

            <div className="print-invoice-items">
              <h3>اقلام سفارش</h3>
              <table className="print-invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>#</th>
                    <th>نام محصول</th>
                    <th style={{ width: '50px', textAlign: 'center' }}>
                      تعداد
                    </th>
                    <th style={{ width: '90px', textAlign: 'left' }}>
                      قیمت واحد
                    </th>
                    <th style={{ width: '100px', textAlign: 'left' }}>
                      جمع
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{formatPrice(idx + 1)}</td>
                      <td>
                        {item.product_name}
                        {item.option_name && (
                          <small style={{ color: '#666', display: 'block' }}>
                            ({item.option_name})
                          </small>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {formatPrice(item.quantity)}
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        {formatPrice(item.unit_price)}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 700 }}>
                        {formatPrice(item.unit_price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {printOrder.coupon_code && printOrder.coupon_discount ? (
                    <>
                      <tr className="invoice-summary-row">
                        <td colSpan={4}>جمع اقلام:</td>
                        <td>
                          {formatPrice(
                            printOrder.original_subtotal ??
                              printOrder.subtotal
                          )}{' '}
                          تومان
                        </td>
                      </tr>
                      <tr className="invoice-summary-row invoice-discount-row">
                        <td colSpan={4}>
                          🎟️ تخفیف ({printOrder.coupon_code}):
                        </td>
                        <td>
                          − {formatPrice(printOrder.coupon_discount)} تومان
                        </td>
                      </tr>
                      <tr className="invoice-summary-row invoice-total-row">
                        <td colSpan={4}>قابل پرداخت:</td>
                        <td>{formatPrice(printOrder.subtotal)} تومان</td>
                      </tr>
                    </>
                  ) : (
                    <tr className="invoice-summary-row invoice-total-row">
                      <td colSpan={4}>جمع کل:</td>
                      <td>{formatPrice(printOrder.subtotal)} تومان</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            <div className="print-invoice-footer">
              <p>این سفارش لغو شده است ❌</p>
              <p className="print-invoice-footer-small">
                کافه پارک — پارک سلامت شیراز
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}