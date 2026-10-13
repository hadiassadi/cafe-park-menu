'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type NewOrder = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  table_number: number | null
  subtotal: number
  items_count: number
  created_at: string
}

type Props = {
  orders: NewOrder[]
  onDismiss: (id: string) => void
  onDismissAll: () => void
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

export default function NewOrderAlert({
  orders,
  onDismiss,
  onDismissAll,
}: Props) {
  const router = useRouter()

  if (orders.length === 0) return null

  return (
    <div className="new-order-alert-container">
      {orders.length > 1 && (
        <div className="new-order-alert-header">
          <span>
            🔔 {orders.length.toLocaleString('fa-IR')} سفارش جدید
          </span>
          <button
            type="button"
            className="new-order-alert-dismiss-all"
            onClick={onDismissAll}
          >
            بستن همه
          </button>
        </div>
      )}

      {orders.slice(0, 3).map((order) => (
        <div key={order.id} className="new-order-alert">
          <div className="new-order-alert-body">
            <div className="new-order-alert-title">
              <span className="new-order-alert-icon">🎉</span>
              <strong>سفارش #{order.order_number}</strong>
            </div>
            <div className="new-order-alert-info">
              <div>
                👤 <strong>{order.customer_name}</strong>
              </div>
              <div>
                🛒 {order.items_count.toLocaleString('fa-IR')} قلم ·{' '}
                {formatPrice(order.subtotal)} تومان
              </div>
              {order.table_number && (
                <div>📍 میز {order.table_number}</div>
              )}
            </div>
          </div>

          <div className="new-order-alert-actions">
            <button
              type="button"
              className="new-order-alert-view"
              onClick={() => {
                onDismiss(order.id)
                router.push('/admin/orders')
              }}
            >
              👁️ مشاهده
            </button>
            <button
              type="button"
              className="new-order-alert-close"
              onClick={() => onDismiss(order.id)}
              aria-label="بستن"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {orders.length > 3 && (
        <div className="new-order-alert-more">
          + {(orders.length - 3).toLocaleString('fa-IR')} سفارش دیگر
        </div>
      )}
    </div>
  )
}