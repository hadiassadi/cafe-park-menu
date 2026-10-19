'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { formatPersianDate } from '@/lib/format-date'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
  variant_option_id?: string | null
  variant_group_id?: string | null
  product_id?: string | null
  image_url?: string | null
}

type Order = {
  id: string
  order_number: number
  items: OrderItem[]
  subtotal: number
  original_subtotal: number | null
  coupon_code: string | null
  coupon_discount: number | null
  status: string
  created_at: string
  cancelled_by: string | null
  cancellation_reason_label: string | null
  customer_name: string
  customer_phone: string
}

type Filter = 'all' | 'active' | 'delivered' | 'cancelled'

const FILTER_LABELS: Record<Filter, string> = {
  all: 'همه',
  active: 'در جریان',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'در انتظار تأیید', color: '#9a6b3f', icon: '⏳' },
  confirmed: { label: 'تأیید شده', color: '#4a7c9b', icon: '✓' },
  preparing: { label: 'در حال آماده‌سازی', color: '#9a6b3f', icon: '☕' },
  ready: { label: 'آماده تحویل', color: '#477052', icon: '🔔' },
  delivered: { label: 'تحویل شده', color: '#477052', icon: '✅' },
  cancelled: { label: 'لغو شده', color: '#9b3c32', icon: '❌' },
}

export default function MyOrdersClient() {
  const { addItem } = useCart()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [customer, setCustomer] = useState<{ name: string; phone: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const meRes = await fetch('/api/customer/me', { cache: 'no-store' })
        const meData = await meRes.json()
        if (meData.customer) {
          setCustomer(meData.customer)
        }

        const ordersRes = await fetch('/api/customer/orders', { cache: 'no-store' })
        const ordersData = await ordersRes.json()
        if (ordersData.orders) {
          setOrders(ordersData.orders)
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  function handleReorder(order: Order) {
    for (const item of order.items) {
      addItem({
        productId: item.product_id || '',
        productName: item.product_name,
        productImage: item.image_url || null,
        selectedGroupName: null,
        selectedOptionName: item.option_name,
        selectedOptionId: item.variant_option_id || null,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        note: undefined,
      })
    }
    setToast('✅ آیتم‌ها به سبد اضافه شدن')
    setTimeout(() => {
      window.location.href = '/cart'
    }, 800)
  }

  if (loading) {
    return (
      <div className="my-orders-page">
        <div className="my-orders-header">
          <Link href="/" className="my-orders-back">← منو</Link>
          <h1>سفارش‌های من</h1>
          <span style={{ width: 60 }} />
        </div>
        <div className="my-orders-empty">⏳ در حال بارگذاری...</div>
      </div>
    )
  }

  const filtered = orders.filter((o) => {
    if (filter === 'all') return true
    if (filter === 'active')
      return ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
    if (filter === 'delivered') return o.status === 'delivered'
    if (filter === 'cancelled') return o.status === 'cancelled'
    return true
  })

  return (
    <div className="my-orders-page">
      <div className="my-orders-header">
        <Link href="/" className="my-orders-back">← منو</Link>
        <h1>سفارش‌های من</h1>
        <span style={{ width: 60 }} />
      </div>

      {customer ? (
        <div className="my-orders-user">
          <div className="my-orders-user-icon">👤</div>
          <div>
            <strong>{customer.name}</strong>
            <small dir="ltr">{customer.phone}</small>
          </div>
        </div>
      ) : (
        <div className="my-orders-empty" style={{ marginBottom: '16px' }}>
          هنوز سفارشی با این دستگاه ثبت نکردی. برای دیدن تاریخچه، یک سفارش ثبت کن!
        </div>
      )}

      {orders.length > 0 && (
        <div className="my-orders-filters">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
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
      )}

      {filtered.length === 0 ? (
        <div className="my-orders-empty">
          {orders.length === 0
            ? 'هنوز سفارشی ثبت نکردی.'
            : 'سفارشی با این فیلتر پیدا نشد.'}
        </div>
      ) : (
        <div className="my-orders-list">
          {filtered.map((order) => {
            const info = STATUS_INFO[order.status] || STATUS_INFO.pending
            return (
              <div key={order.id} className="my-order-card">
                <div className="my-order-header">
                  <div className="my-order-num">
                    🧾 سفارش #{formatPrice(order.order_number)}
                  </div>
                  <span
                    className="my-order-status"
                    style={{ background: info.color + '20', color: info.color }}
                  >
                    {info.icon} {info.label}
                  </span>
                </div>

                <div className="my-order-date">
                  📅 {formatPersianDate(order.created_at)}
                </div>

                <div className="my-order-items">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="my-order-item">
                      <span>
                        {formatPrice(item.quantity)}× {item.product_name}
                        {item.option_name && (
                          <small> ({item.option_name})</small>
                        )}
                      </span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="my-order-item-more">
                      + {formatPrice(order.items.length - 3)} آیتم دیگه
                    </div>
                  )}
                </div>

                <div className="my-order-total">
                  <span>جمع کل:</span>
                  <strong>{formatPrice(order.subtotal)} تومان</strong>
                </div>

                {order.status === 'cancelled' && order.cancelled_by === 'admin' && (
                  <div className="my-order-cancel-reason">
                    دلیل لغو: {order.cancellation_reason_label || 'نامشخص'}
                  </div>
                )}

                <div className="my-orders-actions" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="my-order-btn primary"
                    style={{ flex: 1 }}
                    onClick={() => handleReorder(order)}
                  >
                    🔄 سفارش مجدد
                  </button>
                  <Link
                    href={`/order/${order.id}`}
                    className="my-order-btn"
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    👁️ جزئیات
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}