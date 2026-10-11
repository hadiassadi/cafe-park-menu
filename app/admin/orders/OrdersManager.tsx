'use client'

import { useState, useEffect, useMemo } from 'react'
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

export default function OrdersManager({
  orders: initialOrders,
}: {
  orders: Order[]
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [filter, setFilter] = useState<Filter>('pending')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)

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
      </div>

      {/* فیلترها */}
      <div className="toolbar" style={{ padding: '0 0 16px 0', background: 'transparent', borderBottom: 'none', position: 'static' }}>
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
                <span className="order-id">سفارش #{formatPrice(order.order_number)}</span>
                <span className="order-time">{formatTime(order.created_at)}</span>
              </div>

              <div className="order-body">
                <div>👤 <strong>{order.customer_name}</strong></div>
                <div>📞 <span dir="ltr">{order.customer_phone}</span></div>
                {order.table_number && (
                  <div>📍 میز {formatPrice(order.table_number)}</div>
                )}
                <div>🧾 {formatPrice(order.items.length)} قلم · {formatPrice(order.subtotal)} تومان</div>
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
                      {item.option_name && <small> ({item.option_name})</small>}
                    </span>
                    <strong>{formatPrice(item.unit_price * item.quantity)}</strong>
                  </div>
                ))}
                <div className="total-row">
                  <span>جمع کل</span>
                  <span>{formatPrice(selectedOrder.subtotal)} تومان</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
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
  )
}