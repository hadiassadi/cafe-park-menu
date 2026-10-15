'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@supabase/supabase-js'
import { updateOrderStatus } from './actions'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

const formatTime = (iso: string) => {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'همین الان'
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`
  return `${Math.floor(diff / 86400)} روز پیش`
}

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
  discount_amount?: number
}

type Order = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  table_number: number | null
  note: string | null
  items: OrderItem[]
  subtotal: number
  original_subtotal: number | null
  coupon_code: string | null
  coupon_discount: number | null
  eligible_subtotal: number | null
  ineligible_subtotal: number | null
  status: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'جدید',
  confirmed: 'تأیید شده',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده تحویل',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'status-pending',
  confirmed: 'status-confirmed',
  preparing: 'status-preparing',
  ready: 'status-ready',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled',
}

const NEXT_STATUS: Record<string, string | null> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
  cancelled: null,
}

const NEXT_LABEL: Record<string, string> = {
  pending: '👍 تأیید سفارش',
  confirmed: '☕ شروع آماده‌سازی',
  preparing: '🔔 آماده شد',
  ready: '🎉 تحویل شد',
}

type Filter = 'all' | 'pending' | 'active' | 'done'

type ExportFilter = 'today' | 'week' | 'month' | 'all'
type ExportStatus = 'all' | 'delivered' | 'active' | 'cancelled'

const EXPORT_FILTER_LABELS: Record<ExportFilter, string> = {
  today: 'امروز',
  week: 'این هفته',
  month: 'این ماه',
  all: 'همه',
}

const EXPORT_STATUS_LABELS: Record<ExportStatus, string> = {
  all: 'همه وضعیت‌ها',
  delivered: 'فقط تحویل‌شده',
  active: 'فقط در جریان',
  cancelled: 'فقط لغو‌شده',
}

export default function OrdersManager({
  orders: initialOrders,
}: {
  orders: Order[]
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [filter, setFilter] = useState<Filter>('pending')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [mounted, setMounted] = useState(false)

  // ✅ State های Export
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFilter, setExportFilter] = useState<ExportFilter>('month')
  const [exportStatus, setExportStatus] = useState<ExportStatus>('all')
  const [exporting, setExporting] = useState(false)

  // اطمینان از اینکه فقط سمت کلاینت رندر می‌شه
  useEffect(() => {
    setMounted(true)
  }, [])

  // ─── useEffect اول: Realtime ───
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return

    const supabase = createClient(url, key)

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as Order, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === payload.new.id ? (payload.new as Order) : o
              )
            )
            setSelectedOrder((prev) =>
              prev?.id === payload.new.id ? (payload.new as Order) : prev
            )
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ─── useEffect دوم: چاپ فاکتور ───
  useEffect(() => {
    if (!printOrder) return

    const handleAfterPrint = () => {
      setPrintOrder(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    const timer = setTimeout(() => {
      window.print()
    }, 500)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printOrder])

  // ✅ Export به CSV
    async function handleExport() {
    setExporting(true)
    try {
      const url = `/api/export/orders?filter=${exportFilter}&status=${exportStatus}`
      const res = await fetch(url)

      if (!res.ok) {
        throw new Error('خطا در ساخت فایل')
      }

      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)

      // ✅ اسم فایل با تاریخ میلادی (ASCII-safe)
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')

      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `cafe-park-orders-${y}-${m}-${d}_${hh}-${mm}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      setExportOpen(false)
    } catch (err) {
      alert('❌ خطا در دانلود فایل')
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const counts = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === 'pending').length,
      active: orders.filter((o) =>
        ['confirmed', 'preparing', 'ready'].includes(o.status)
      ).length,
      done: orders.filter((o) =>
        ['delivered', 'cancelled'].includes(o.status)
      ).length,
      all: orders.length,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'pending')
      return orders.filter((o) => o.status === 'pending')
    if (filter === 'active')
      return orders.filter((o) =>
        ['confirmed', 'preparing', 'ready'].includes(o.status)
      )
    if (filter === 'done')
      return orders.filter((o) =>
        ['delivered', 'cancelled'].includes(o.status)
      )
    return orders
  }, [orders, filter])

  async function handleStatusChange(order: Order, newStatus: string) {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('id', order.id)
      formData.append('status', newStatus)

      const result = await updateOrderStatus(formData)
      if (result?.error) {
        alert('❌ ' + result.error)
        return
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, status: newStatus } : o
        )
      )
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: newStatus })
      }
    } catch {
      alert('❌ خطا در تغییر وضعیت')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(order: Order) {
    if (!confirm(`مطمئنی می‌خوای سفارش #${order.order_number} رو لغو کنی؟`))
      return
    await handleStatusChange(order, 'cancelled')
  }

  return (
    <>
      <div className="admin-main">
        {/* هدر */}
        <div className="admin-header">
          <div>
            <h1>مدیریت سفارش‌ها</h1>
            <p className="admin-subtitle">
              {counts.pending > 0 ? (
                <>
                  <b style={{ color: '#9b3c32' }}>
                    {formatPrice(counts.pending)} سفارش جدید
                  </b>{' '}
                  در انتظار تأیید
                </>
              ) : (
                'سفارش جدیدی در انتظار تأیید نیست'
              )}
            </p>
          </div>

          {/* ✅ دکمه خروجی Excel */}
          <button
            type="button"
            className="btn"
            onClick={() => setExportOpen(true)}
            title="خروجی Excel (CSV)"
          >
            📥 خروجی Excel
          </button>
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
          <button
            type="button"
            className={`filter-chip ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            🔴 جدید ({formatPrice(counts.pending)})
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            ⏳ در جریان ({formatPrice(counts.active)})
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            ✅ تمام‌شده ({formatPrice(counts.done)})
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            📋 همه ({formatPrice(counts.all)})
          </button>
        </div>

        {/* لیست سفارش‌ها */}
        {filteredOrders.length === 0 ? (
          <div className="admin-card">
            <p className="empty-admin">سفارشی در این بخش نیست.</p>
          </div>
        ) : (
          <div className="orders-grid">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`order-card ${STATUS_COLORS[order.status]}`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="order-header">
                  <span className="order-id">
                    سفارش #{formatPrice(order.order_number)}
                  </span>
                  <span className="order-time">
                    {formatTime(order.created_at)}
                  </span>
                </div>

                <div className="order-body">
                  <div>
                    👤 <strong>{order.customer_name}</strong>
                  </div>
                  <div>
                    📞 <span dir="ltr">{order.customer_phone}</span>
                  </div>
                  {order.table_number && (
                    <div>📍 میز {formatPrice(order.table_number)}</div>
                  )}
                  <div>
                    🧾 {formatPrice(order.items.length)} قلم ·{' '}
                    {formatPrice(order.subtotal)} تومان
                  </div>
                </div>

                <div className="order-actions">
                  {NEXT_STATUS[order.status] && (
                    <button
                      type="button"
                      className="btn btn-approve"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStatusChange(order, NEXT_STATUS[order.status]!)
                      }}
                      disabled={loading}
                    >
                      {NEXT_LABEL[order.status]}
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button
                      type="button"
                      className="btn btn-cancel"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCancel(order)
                      }}
                      disabled={loading}
                    >
                      ❌ لغو
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal جزئیات سفارش */}
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
                  <p>وضعیت: {STATUS_LABELS[selectedOrder.status]}</p>
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
                <div className="info-card">
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
                      <span>توضیحات:</span>
                      <strong>{selectedOrder.note}</strong>
                    </div>
                  )}
                </div>

                <div className="info-card" style={{ marginTop: '16px' }}>
                  <h3>🧾 اقلام سفارش</h3>
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
                      <div
                        className="info-row"
                        style={{ marginTop: '10px' }}
                      >
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
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPrintOrder(selectedOrder)}
                  title="چاپ فاکتور"
                >
                  🖨️ چاپ
                </button>
                <a
                  href={`tel:${selectedOrder.customer_phone}`}
                  className="btn"
                  style={{ textDecoration: 'none' }}
                >
                  📞 تماس
                </a>
                {NEXT_STATUS[selectedOrder.status] && (
                  <button
                    type="button"
                    className="btn primary-btn"
                    onClick={() =>
                      handleStatusChange(
                        selectedOrder,
                        NEXT_STATUS[selectedOrder.status]!
                      )
                    }
                    disabled={loading}
                  >
                    {NEXT_LABEL[selectedOrder.status]}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Modal خروجی Excel */}
      {exportOpen && (
        <div
          className="modal-overlay"
          onClick={() => !exporting && setExportOpen(false)}
        >
          <div
            className="modal-container modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>📥 خروجی Excel</h2>
                <p>فایل CSV برای اکسل و حسابداری</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setExportOpen(false)}
                disabled={exporting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="export-field">
                <label>بازه زمانی</label>
                <div className="export-options">
                  {(Object.keys(EXPORT_FILTER_LABELS) as ExportFilter[]).map(
                    (f) => (
                      <button
                        key={f}
                        type="button"
                        className={`export-option ${
                          exportFilter === f ? 'active' : ''
                        }`}
                        onClick={() => setExportFilter(f)}
                      >
                        {EXPORT_FILTER_LABELS[f]}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="export-field" style={{ marginTop: '16px' }}>
                <label>وضعیت سفارش</label>
                <div className="export-options">
                  {(Object.keys(EXPORT_STATUS_LABELS) as ExportStatus[]).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        className={`export-option ${
                          exportStatus === s ? 'active' : ''
                        }`}
                        onClick={() => setExportStatus(s)}
                      >
                        {EXPORT_STATUS_LABELS[s]}
                      </button>
                    )
                  )}
                </div>
              </div>

              <p className="export-hint">
                📌 فایل با فرمت CSV دانلود می‌شود که در Excel، Google Sheets
                و WPS Office باز می‌شود.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setExportOpen(false)}
                disabled={exporting}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn primary-btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? '...' : '📥 دانلود فایل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── فاکتور چاپی — با Portal به body منتقل می‌شه ─── */}
      {mounted &&
        printOrder &&
        createPortal(
          <div className="print-invoice">
            <div className="print-invoice-header">
              <h1 className="print-invoice-title">کافه پارک</h1>
              <p className="print-invoice-subtitle">فاکتور سفارش</p>
            </div>

            <div className="print-invoice-meta">
              <div className="print-invoice-meta-row">
                <span>شماره سفارش:</span>
                <strong>#{formatPrice(printOrder.order_number)}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>تاریخ و ساعت:</span>
                <strong>
                  {new Date(printOrder.created_at).toLocaleString('fa-IR')}
                </strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>وضعیت:</span>
                <strong>{STATUS_LABELS[printOrder.status]}</strong>
              </div>
            </div>

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
                  <span>توضیحات:</span>
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
                    <th style={{ width: '90px', textAlign: 'left' }}>
                      تخفیف
                    </th>
                    <th style={{ width: '100px', textAlign: 'left' }}>
                      جمع
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printOrder.items.map((item: any, idx) => {
                    const itemDiscount = item.discount_amount || 0
                    const itemTotal = item.unit_price * item.quantity
                    const finalItemTotal = itemTotal - itemDiscount

                    return (
                      <tr key={idx}>
                        <td>{formatPrice(idx + 1)}</td>
                        <td>
                          {item.product_name}
                          {item.option_name && (
                            <small
                              style={{ color: '#666', display: 'block' }}
                            >
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
                        <td
                          style={{
                            textAlign: 'left',
                            color: itemDiscount > 0 ? '#2d5d3e' : '#999',
                            fontWeight: itemDiscount > 0 ? 700 : 400,
                          }}
                        >
                          {itemDiscount > 0
                            ? `− ${formatPrice(itemDiscount)}`
                            : '—'}
                        </td>
                        <td style={{ textAlign: 'left', fontWeight: 700 }}>
                          {formatPrice(finalItemTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  {printOrder.coupon_code && printOrder.coupon_discount ? (
                    <>
                      <tr className="invoice-summary-row">
                        <td colSpan={5}>جمع اقلام:</td>
                        <td>
                          {formatPrice(
                            printOrder.original_subtotal ??
                              printOrder.subtotal
                          )}{' '}
                          تومان
                        </td>
                      </tr>
                      <tr className="invoice-summary-row invoice-discount-row">
                        <td colSpan={5}>
                          🎟️ تخفیف ({printOrder.coupon_code}):
                        </td>
                        <td>
                          − {formatPrice(printOrder.coupon_discount)} تومان
                        </td>
                      </tr>
                      <tr className="invoice-summary-row invoice-total-row">
                        <td colSpan={5}>قابل پرداخت:</td>
                        <td>{formatPrice(printOrder.subtotal)} تومان</td>
                      </tr>
                    </>
                  ) : (
                    <tr className="invoice-summary-row invoice-total-row">
                      <td colSpan={5}>جمع کل:</td>
                      <td>{formatPrice(printOrder.subtotal)} تومان</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            <div className="print-invoice-footer">
              <p>با تشکر از سفارش شما 🌹</p>
              <p className="print-invoice-footer-small">
                کافه پارک — پارک سلامت شیراز
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}