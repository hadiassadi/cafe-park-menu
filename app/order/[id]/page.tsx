'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

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

const STATUS_STEPS = [
  { key: 'pending', label: 'ثبت شد', icon: '✓' },
  { key: 'confirmed', label: 'تأیید شد', icon: '✓' },
  { key: 'preparing', label: 'آماده‌سازی', icon: '⏳' },
  { key: 'ready', label: 'آماده تحویل', icon: '🔔' },
  { key: 'delivered', label: 'تحویل شد', icon: '🎉' },
]

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!url || !key) {
        setError('تنظیمات ناقص')
        setLoading(false)
        return
      }
      const supabase = createClient(url, key)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        setError('سفارش پیدا نشد')
      } else {
        setOrder(data as Order)
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!order) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return

    const supabase = createClient(url, key)
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (data) setOrder(data as Order)
    }, 10000)

    return () => clearInterval(interval)
  }, [id, order])

  if (loading) {
    return <div className="order-detail-container" style={{ textAlign: 'center', paddingTop: '50px' }}>در حال بارگذاری سفارش...</div>
  }

  if (error || !order) {
    return (
      <div className="order-detail-container" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <h1>{error || 'خطا'}</h1>
        <Link href="/" className="btn primary-btn" style={{ marginTop: '20px', display: 'inline-flex' }}>
          بازگشت به منو
        </Link>
      </div>
    )
  }

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === order.status)
  const isCancelled = order.status === 'cancelled'

  const whatsappMessage = buildWhatsAppMessage(order)
  const whatsappUrl = `https://wa.me/989301817098?text=${encodeURIComponent(
    whatsappMessage
  )}`

  return (
    <div className="order-detail-container">
      {/* هدر صفحه */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <Link href="/" className="btn" style={{ padding: '6px 12px' }}>
          ← منو
        </Link>
        <h1 style={{ fontSize: '20px', margin: 0, color: '#29251f' }}>
          سفارش #{formatPrice(order.order_number)}
        </h1>
        <span style={{ width: '60px' }} />
      </div>

      {/* استپر وضعیت */}
      {isCancelled ? (
        <div className="info-card" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: 48 }}>❌</div>
          <h2 style={{ color: '#9b3c32' }}>سفارش لغو شد</h2>
          <p style={{ color: '#766f64' }}>این سفارش توسط کافه لغو شده است.</p>
        </div>
      ) : (
        <div className="status-stepper">
          {STATUS_STEPS.map((step, index) => {
            const isDone = index <= currentIndex
            const isCurrent = index === currentIndex
            return (
              <div
                key={step.key}
                className={`step-item ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
              >
                <div className="step-dot">{isDone ? step.icon : ''}</div>
                <span>{step.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* باکس اقلام سفارش */}
      <div className="info-card">
        <h3>🧾 اقلام سفارش</h3>
        {order.table_number && (
          <div style={{ fontSize: '13px', color: '#6b4f3a', marginBottom: '10px' }}>
            📍 میز شماره {formatPrice(order.table_number)}
          </div>
        )}
        
        {order.items.map((item, idx) => (
          <div key={idx} className="info-row">
            <span>
              {formatPrice(item.quantity)} × {item.product_name}
              {item.option_name && <small style={{ color: '#766f64' }}> ({item.option_name})</small>}
            </span>
            <strong>{formatPrice(item.unit_price * item.quantity)} تومان</strong>
          </div>
        ))}

        <div className="total-row">
          <span>جمع کل</span>
          <span>{formatPrice(order.subtotal)} تومان</span>
        </div>
      </div>

      {/* باکس اطلاعات مشتری */}
      <div className="info-card">
        <h3>👤 اطلاعات تماس</h3>
        <div className="info-row">
          <span>نام:</span>
          <strong>{order.customer_name}</strong>
        </div>
        <div className="info-row">
          <span>شماره:</span>
          <strong dir="ltr">{order.customer_phone}</strong>
        </div>
        {order.note && (
          <div className="info-row">
            <span>توضیحات:</span>
            <strong>{order.note}</strong>
          </div>
        )}
      </div>

      {/* دکمه ثابت پایین صفحه (واتساپ) */}
      <div className="sticky-action-bar">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-whatsapp"
        >
          💬 ارسال سفارش در واتساپ
        </a>
      </div>
    </div>
  )
}

function buildWhatsAppMessage(order: Order): string {
  let msg = `سلام، سفارش جدید ثبت کردم.\n\n`
  msg += `📋 سفارش #${order.order_number}\n`
  msg += `👤 ${order.customer_name}\n`
  msg += `📞 ${order.customer_phone}\n`

  if (order.table_number) {
    msg += `📍 میز ${order.table_number}\n`
  }

  msg += `\n🧾 اقلام:\n`
  for (const item of order.items) {
    msg += `  • ${item.quantity} × ${item.product_name}`
    if (item.option_name) msg += ` (${item.option_name})`
    msg += ` - ${item.unit_price * item.quantity} تومان\n`
  }

  msg += `\n💰 جمع کل: ${order.subtotal} تومان`

  if (order.note) {
    msg += `\n\n📝 توضیحات: ${order.note}`
  }

  return msg
}