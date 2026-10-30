'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { formatPersianDate } from '@/lib/format-date'

const formatPrice = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n))

type OrderItem = { product_name: string; option_name: string | null; unit_price: number; quantity: number; variant_option_id?: string | null; variant_group_id?: string | null; product_id?: string | null; image_url?: string | null }
type Order = { id: string; order_number: number; items: OrderItem[]; subtotal: number; original_subtotal: number | null; coupon_code: string | null; coupon_discount: number | null; status: string; created_at: string; cancelled_by: string | null; cancellation_reason_label: string | null; customer_name: string; customer_phone: string; payment_status?: string; payment_method?: string }

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'در انتظار تأیید', color: '#9a6b3f', icon: '⏳' },
  confirmed: { label: 'تأیید شده', color: '#4a7c9b', icon: '✓' },
  preparing: { label: 'در حال آماده‌سازی', color: '#9a6b3f', icon: '☕' },
  ready: { label: 'آماده تحویل', color: '#477052', icon: '🔔' },
  delivered: { label: 'تحویل شده', color: '#477052', icon: '✅' },
  cancelled: { label: 'لغو شده', color: '#9b3c32', icon: '❌' },
}

const getPaymentMethodLabel = (method: string | null | undefined) => {
  if (method === 'online') return 'آنلاین';
  if (method === 'cash') return 'نقدی';
  if (method === 'card') return 'کارت‌خوان';
  if (method === 'transfer') return 'کارت به کارت';
  return 'نامشخص';
};

export default function MyOrdersClient() {
  const { addItem } = useCart()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  
  // ✅ تب‌های اصلی (سفارش‌های باز / تاریخچه)
  const [activeTab, setActiveTab] = useState<'open' | 'history' | 'debt'>('open')
  const [customer, setCustomer] = useState<{ name: string; phone: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberPhone, setMemberPhone] = useState('')
  const [acceptRules, setAcceptRules] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerMsg, setRegisterMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('general')
  const [membership, setMembership] = useState<{ orgId: string, orgName: string } | null>(null)
  const [rules, setRules] = useState<{ general: string; org: string }>({ general: 'در حال بارگذاری...', org: 'در حال بارگذاری...' })

  useEffect(() => {
    async function loadData() {
      try {
        const meRes = await fetch('/api/customer/me', { cache: 'no-store' })
        const meData = await meRes.json()
        if (meData.customer) setCustomer(meData.customer)
        if (meData.membership) setMembership(meData.membership)

        const ordersRes = await fetch('/api/customer/orders', { cache: 'no-store' })
        const ordersData = await ordersRes.json()
        if (ordersData.orders) setOrders(ordersData.orders)

        const orgsRes = await fetch('/api/membership/organizations', { cache: 'no-store' })
        const orgsData = await orgsRes.json()
        if (orgsData.organizations) setOrganizations(orgsData.organizations)

        const rulesRes = await fetch('/api/membership/rules', { cache: 'no-store' })
        const rulesData = await rulesRes.json()
        if (rulesData.general) setRules({ general: rulesData.general, org: rulesData.org })
      } catch {} finally { setLoading(false) }
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
      addItem({ productId: item.product_id || '', productName: item.product_name, productImage: item.image_url || null, selectedGroupName: null, selectedOptionName: item.option_name, selectedOptionId: item.variant_option_id || null, unitPrice: item.unit_price, quantity: item.quantity, note: undefined })
    }
    setToast('✅ آیتم‌ها به سبد اضافه شدن')
    setTimeout(() => { window.location.href = '/cart' }, 800)
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptRules) return setRegisterMsg({ type: 'error', text: 'لطفاً قوانین و شرایط را بپذیرید.' })
    setRegisterLoading(true); setRegisterMsg(null)
    try {
      const res = await fetch('/api/membership/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: memberName, memberId: selectedOrgId !== 'general' ? memberId : null, phone: memberPhone, orgId: selectedOrgId }) })
      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'خطا در ثبت‌نام')
      setRegisterMsg({ type: 'success', text: data.message })
      setTimeout(() => { setShowMemberModal(false); window.location.reload() }, 3000)
    } catch (err: any) { setRegisterMsg({ type: 'error', text: err.message }) } finally { setRegisterLoading(false) }
  }

  if (loading) {
    return <div className="my-orders-page"><div className="my-orders-header"><Link href="/" className="my-orders-back">← منو</Link><h1>سفارش‌های من</h1><span style={{ width: 60 }} /></div><div className="my-orders-empty">⏳ در حال بارگذاری...</div></div>
  }

  // ✅ محاسبه آمار برای داشبورد
  const validOrders = orders.filter(o => o.status !== 'cancelled')
  const totalSpent = validOrders.reduce((sum, o) => sum + o.subtotal, 0)
  const totalDiscount = validOrders.reduce((sum, o) => sum + (o.coupon_discount || 0), 0)

  // ✅ فیلتر کردن سفارش‌ها بر اساس تب فعال
    // ✅ بدهی = تحویل‌شده و تسویه‌نشده
  const debtOrders = orders.filter(
    (o) => o.status === 'delivered' && o.payment_status !== 'paid'
  )
  const debtTotal = debtOrders.reduce((sum, o) => sum + o.subtotal, 0)

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'open') {
      return ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
    }
    if (activeTab === 'debt') {
      return o.status === 'delivered' && o.payment_status !== 'paid'
    }
    return ['delivered', 'cancelled'].includes(o.status)
  })


  return (
    <div className="my-orders-page">
      {/* ✅ هدر بازطراحی شده */}
      <div className="my-orders-header" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '0', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #e3ddd2' }}>
          <Link href="/" className="my-orders-back" style={{ padding: '6px 12px', fontSize: '13px' }}>← منو</Link>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#29251f' }}>پنل مشتری</h1>
          <span style={{ width: '60px' }} />
        </div>

        {/* ✅ تب‌های جدید */}
        <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid #e3ddd2' }}>
          <button
            onClick={() => setActiveTab('open')}
            style={{
              flex: 1, padding: '14px 10px', fontSize: '14px', fontWeight: 'bold',
              background: 'transparent', border: 'none', 
              borderBottom: activeTab === 'open' ? '3px solid #6b4f3a' : '3px solid transparent',
              color: activeTab === 'open' ? '#6b4f3a' : '#766f64', 
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            🛍️ سفارش‌های باز
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1, padding: '14px 10px', fontSize: '14px', fontWeight: 'bold',
              background: 'transparent', border: 'none', 
              borderBottom: activeTab === 'history' ? '3px solid #6b4f3a' : '3px solid transparent',
              color: activeTab === 'history' ? '#6b4f3a' : '#766f64', 
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            📜 تاریخچه سفارشات
          </button>
		            <button
            onClick={() => setActiveTab('debt')}
            style={{
              flex: 1, padding: '14px 10px', fontSize: '14px', fontWeight: 'bold',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === 'debt' ? '3px solid #9b3c32' : '3px solid transparent',
              color: activeTab === 'debt' ? '#9b3c32' : '#766f64',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            💸 بدهی‌ها{debtOrders.length > 0 ? ` (${debtOrders.length.toLocaleString('fa-IR')})` : ''}
          </button>

        </div>
      </div>

      {/* ✅ کارت خوش‌آمدگویی و آمار */}
      {customer && (
        <div className="my-orders-user" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', background: 'linear-gradient(135deg, #fffdf9 0%, #fbf9f5 100%)', border: '1px solid #e3ddd2', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="my-orders-user-icon">👤</div>
            <div>
              <strong style={{ fontSize: '18px' }}>
                خوش اومدی، {customer.name && customer.name !== 'کاربر' ? `${customer.name} عزیز` : 'دوست عزیز'}! 🌟
              </strong>
              <small dir="ltr">{customer.phone}</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%', marginTop: '8px' }}>
            <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #ebe6de' }}>
              <div style={{ fontSize: '11px', color: '#766f64', marginBottom: '4px' }}>کل سفارشات</div>
              <strong style={{ fontSize: '16px', color: '#6b4f3a' }}>{orders.length.toLocaleString('fa-IR')}</strong>
            </div>
            <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #ebe6de' }}>
              <div style={{ fontSize: '11px', color: '#766f64', marginBottom: '4px' }}>مجموع خرید</div>
              <strong style={{ fontSize: '14px', color: '#2d5d3e' }}>{formatPrice(totalSpent)} <small>ت</small></strong>
            </div>
            <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #ebe6de' }}>
              <div style={{ fontSize: '11px', color: '#766f64', marginBottom: '4px' }}>تخفیفات</div>
              <strong style={{ fontSize: '14px', color: '#9b3c32' }}>
                {totalDiscount > 0 ? formatPrice(totalDiscount) : '-'} <small>ت</small>
              </strong>
            </div>
          </div>
        </div>
      )}

      {membership ? (
        <div style={{ background: '#e5f0e6', border: '1.5px solid #477052', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '28px' }}>✅</div>
          <div>
            <strong style={{ fontSize: '14px', color: '#2d5d3e', display: 'block' }}>
              {membership.orgId === 'general' 
                ? 'شما عضو باشگاه مشتریان کافه پارک هستید' 
                : `شما عضو باشگاه ${membership.orgName} هستید`
              }
            </strong>
            <small style={{ fontSize: '11px', color: '#3d6b48' }}>
              {membership.orgId === 'general'
                ? 'اطلاعات شما در سیستم ثبت شده است و از اخبار و امکانات ویژه باخبر خواهید شد.'
                : 'تخفیف‌های سازمانی شما به این دستگاه متصل است و در زمان سفارش اعمال می‌شود.'
              }
            </small>
          </div>
        </div>
      ) : (
        <div onClick={() => setShowMemberModal(true)} style={{ background: 'linear-gradient(135deg, #fdf6e3 0%, #fef8e8 100%)', border: '1.5px solid #d99f59', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '16px', boxShadow: '0 4px 12px rgba(217, 159, 89, 0.1)' }}>
          <div style={{ fontSize: '28px' }}>🎓</div>
          <div>
            <strong style={{ fontSize: '14px', color: '#6b4f3a', display: 'block' }}>عضویت در باشگاه مشتریان و سازمان‌ها</strong>
            <small style={{ fontSize: '11px', color: '#766f64' }}>با ثبت‌نام، از تخفیف‌های ویژه و خودکار بهره‌مند شوید.</small>
          </div>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="my-orders-empty">
                    {activeTab === 'open'
            ? 'در حال حاضر هیچ سفارش بازی ندارید.'
            : activeTab === 'debt'
              ? '🎉 هیچ سفارش تسویه‌نشده‌ای ندارید.'
              : 'هنوز سابقه سفارشی (تحویل شده یا لغو شده) ندارید.'}
        </div>
      ) : (
        <div className="my-orders-list" style={{ marginTop: '16px' }}>
		          {activeTab === 'debt' && (
            <div style={{ background: '#fde8e6', border: '1px solid #e8b8b2', color: '#9b3c32', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
              مجموع مبلغ تسویه‌نشده: {formatPrice(debtTotal)} تومان
            </div>
          )}

          {filteredOrders.map((order) => {
            const info = STATUS_INFO[order.status] || STATUS_INFO.pending
            return (
              <div key={order.id} className="my-order-card">
                <div className="my-order-header">
                  <div className="my-order-num">🧾 سفارش #{formatPrice(order.order_number)}</div>
                  <span className="my-order-status" style={{ background: info.color + '20', color: info.color }}>{info.icon} {info.label}</span>
                </div>
                
                <div className="my-order-date" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>📅 {formatPersianDate(order.created_at)}</span>
                  {order.payment_status === 'paid' ? (
                    <span style={{ color: '#2d5d3e', fontWeight: 'bold', fontSize: '11px', background: '#e5f0e6', padding: '2px 6px', borderRadius: '4px' }}>
                      ✅ تسویه شد ({getPaymentMethodLabel(order.payment_method)})
                    </span>
                  ) : order.payment_status === 'pending_review' ? (
                    <span style={{ color: '#9a6b3f', fontWeight: 'bold', fontSize: '11px', background: '#fff4d9', padding: '2px 6px', borderRadius: '4px' }}>
                      ⏳ در انتظار تایید رسید
                    </span>
                  ) : (
                    <span style={{ color: '#9b3c32', fontWeight: 'bold', fontSize: '11px', background: '#fde8e6', padding: '2px 6px', borderRadius: '4px' }}>
                      ⏱ پرداخت نشده
                    </span>
                  )}
                </div>

                <div className="my-order-items">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="my-order-item"><span>{formatPrice(item.quantity)}× {item.product_name}{item.option_name && <small> ({item.option_name})</small>}</span></div>
                  ))}
                  {order.items.length > 3 && <div className="my-order-item-more">+ {formatPrice(order.items.length - 3)} آیتم دیگه</div>}
                </div>
                
                <div className="my-order-total">
                  <div>
                    <span>جمع کل:</span>
                    {order.status === 'cancelled' ? (
                      <strong style={{ textDecoration: 'line-through', color: '#9b3c32' }}>
                        {formatPrice(order.subtotal)} تومان
                      </strong>
                    ) : (
                      <strong>{formatPrice(order.subtotal)} تومان</strong>
                    )}
                  </div>
                  {order.coupon_discount && order.coupon_discount > 0 ? (
                    <div style={{ fontSize: '12px', color: '#2d5d3e', marginTop: '6px', fontWeight: 'bold', background: '#e5f0e6', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                      🎁 تخفیف شما از این سفارش: {formatPrice(order.coupon_discount)} تومان
                    </div>
                  ) : null}
                </div>

                {order.status === 'cancelled' && (
                  <div className="my-order-cancel-reason">
                    ❌ سفارش لغو شده {order.cancellation_reason_label ? `به دلیل: ${order.cancellation_reason_label}` : ''}
                  </div>
                )}
                                {activeTab === 'debt' && (
                  <Link
                    href={`/order/${order.id}`}
                    className="my-order-btn primary"
                    style={{ display: 'block', textAlign: 'center', marginTop: '10px' }}
                  >
                    💳 مشاهده و تسویه
                  </Link>
                )}

				<div className="my-orders-actions" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button type="button" className="my-order-btn primary" style={{ flex: 1 }} onClick={() => handleReorder(order)}>🔄 سفارش مجدد</button>
                  <Link href={`/order/${order.id}`} className="my-order-btn" style={{ flex: 1, textAlign: 'center' }}>👁️ جزئیات</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {showMemberModal && (
        <div className="modal-overlay" onClick={() => !registerLoading && setShowMemberModal(false)}>
          <div className="modal-container modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content"><h2>🎓 ثبت‌نام در باشگاه مشتریان</h2><p>لطفاً نوع عضویت خود را انتخاب کرده و اطلاعات را وارد کنید.</p></div>
              <button type="button" className="modal-close-btn" onClick={() => setShowMemberModal(false)} disabled={registerLoading}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="field">
                  <label>نوع عضویت / سازمان *</label>
                  <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d8d0c4', background: '#fffdf9', fontFamily: 'inherit', fontSize: '14px', color: '#29251f', outline: 'none', cursor: 'pointer' }}>
                    <option value="general">👤 باشگاه مشتریان کافه پارک (عادی)</option>
                    {organizations.map(org => (<option key={org.id} value={org.id}>🎓 {org.name}</option>))}
                  </select>
                </div>
                <div className="field"><label>نام و نام خانوادگی *</label><input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} required /></div>
                {selectedOrgId !== 'general' && (
                  <div className="field"><label>شماره دانشجویی / پرسنلی *</label><input type="text" value={memberId} onChange={(e) => setMemberId(e.target.value)} required={selectedOrgId !== 'general'} /></div>
                )}
                <div className="field"><label>شماره تلفن همراه *</label><input type="tel" value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} dir="ltr" required /></div>
                
                <div style={{ background: '#fbf9f5', border: '1px dashed #d8d0c4', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#766f64', lineHeight: 1.8 }}>
                  <strong style={{ color: '#6b4f3a', display: 'block', marginBottom: '6px' }}>📜 شرایط استفاده:</strong>
                  <div style={{ whiteSpace: 'pre-line' }}>{selectedOrgId === 'general' ? rules.general : rules.org}</div>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #d8d0c4', color: '#9b3c32', fontSize: '11px' }}>⚠️ پذیرفتن این قوانین به منزله اجرای همیشگی آن‌ها نیست. کافه پارک حق تغییر این شرایط را بر اساس شرایط اقتصادی برای خود محفوظ می‌دارد.</div>
                </div>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={acceptRules} onChange={(e) => setAcceptRules(e.target.checked)} />
                  <span>شرایط فوق را خوانده‌ام و اطلاعات وارد شده مربوط به خودم است.</span>
                </label>

                {registerMsg && (
                  <div style={{ padding: '10px', borderRadius: '8px', background: registerMsg.type === 'success' ? '#e5f0e6' : '#fde8e6', color: registerMsg.type === 'success' ? '#2d5d3e' : '#9b3c32', fontSize: '12px', fontWeight: 700, textAlign: 'center' }}>{registerMsg.text}</div>
                )}

                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <button type="submit" className="checkout-btn" style={{ flex: 1 }} disabled={registerLoading || !acceptRules}>{registerLoading ? 'در حال بررسی...' : '✅ ثبت‌نام'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}