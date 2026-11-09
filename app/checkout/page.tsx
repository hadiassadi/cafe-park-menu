'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) => new Intl.NumberFormat('fa-IR').format(Math.round(price))
const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

type PaymentMethod = 'online' | 'cash' | 'card' | 'transfer' | 'wallet'
type PaymentSettings = { payment_enabled: boolean; payment_online_enabled: boolean; payment_cash_enabled: boolean; payment_card_enabled: boolean; payment_transfer_enabled: boolean; payment_wallet_enabled: boolean; payment_min_online_amount: number; payment_transfer_bank_name: string | null; payment_transfer_account_number: string | null; payment_transfer_card_number: string | null; payment_transfer_account_holder: string | null; payment_transfer_requires_review: boolean }

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { items, totalItems, totalPrice, takeawayTotal, clearCart } = useCart()
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string } | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [membershipInfo, setMembershipInfo] = useState<{ discount: number, orgName: string | null, discountPercent?: number, message?: string, eligibleProductIds?: string[] } | null>(null)
  
  // ✅ State کوپن
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [walletInfo, setWalletInfo] = useState<{ balance: number; blocked: boolean } | null>(null)
  // 🏆 گرید وفاداری نشست فعلی — فقط پیش‌نمایش؛ محاسبه‌ی قطعی سمت سرور است
  const [gradeInfo, setGradeInfo] = useState<{ name: string; discountPercent: number; color: string | null } | null>(null)
  // ⭐ اشتراک ماهیانه نشست فعلی — فقط پیش‌نمایش
  const [subInfo, setSubInfo] = useState<{ planName: string; discountPercent: number } | null>(null)

  // 👛 کیف پول نشست فعلی (ثبت‌نام با دعوت/OTP) — فقط اگر شناسایی شود نمایش داده می‌شود
  const walletAvailable = !!(walletInfo && walletInfo.balance != null && !walletInfo.blocked)
  const walletBalance = walletAvailable ? walletInfo!.balance : null

  // ✅ تخفیف باشگاه فقط برای اعضای سازمانی
  const isOrgMember = !!(membershipInfo?.orgName && membershipInfo.orgName !== 'باشگاه مشتریان')
  const membershipDiscount = isOrgMember ? (membershipInfo?.discount || 0) : 0
  
  // ✅ کوپن فقط برای مشتریان عادی
  const couponDiscount = !isOrgMember ? (appliedCoupon?.discount || 0) : 0
  
  const totalDiscount = membershipDiscount + couponDiscount
  const finalTotal = Math.max(0, totalPrice - totalDiscount) + takeawayTotal
  const allTakeaway = items.length > 0 && items.every((i) => i.takeaway)
  // اگر موجودی کیف پول برای کل سفارش کافی نباشد، گزینه کیف پول نمایش داده می‌شود ولی غیرفعال است
  const walletShort = walletAvailable && walletBalance != null && walletBalance < finalTotal

  useEffect(() => {
    fetch('/api/customer/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.customer) {
          setCustomerInfo(data.customer)
          setName(data.customer.name)
          setPhone(data.customer.phone)
        }
        setLoadingUser(false)
      })
      .catch(() => setLoadingUser(false))

    fetch('/api/payment/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: PaymentSettings) => {
        setPaymentSettings(data)
        if (data.payment_enabled) {
          if (data.payment_online_enabled) setPaymentMethod('online')
          else if (data.payment_cash_enabled) setPaymentMethod('cash')
          else if (data.payment_card_enabled) setPaymentMethod('card')
          else if (data.payment_transfer_enabled) setPaymentMethod('transfer')
        }
        setSettingsLoading(false)
      })
      .catch(() => setSettingsLoading(false))

    fetch('/api/payment/wallet', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setWalletInfo(
          typeof data?.balance === 'number' && !data?.blocked
            ? { balance: data.balance, blocked: false }
            : null
        )
        if (data?.grade && typeof data.grade.discountPercent === 'number' && data.grade.discountPercent > 0) {
          setGradeInfo({ name: String(data.grade.name ?? ''), discountPercent: Number(data.grade.discountPercent), color: data.grade.color ?? null })
        } else {
          setGradeInfo(null)
        }
        if (data?.subscription && typeof data.subscription.discountPercent === 'number' && data.subscription.discountPercent > 0) {
          setSubInfo({ planName: String(data.subscription.planName ?? ''), discountPercent: Number(data.subscription.discountPercent) })
        } else {
          setSubInfo(null)
        }
      })
      .catch(() => setWalletInfo(null))
  }, [])

  useEffect(() => {
    if (items.length === 0) return
    // شماره تأییدشده هم فرستاده می‌شود تا عضویت سازمانی بدون قفل‌شدن به یک دستگاه پیدا شود
    const calcPhone = toLatinDigits(customerInfo?.phone || phone)
    const body: Record<string, unknown> = {
      items: items.map(i => ({ product_id: i.productId, quantity: i.quantity, unit_price: i.unitPrice })),
    }
    if (/^09\d{9}$/.test(calcPhone)) body.phone = calcPhone
    fetch('/api/membership/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(data => setMembershipInfo(data))
      .catch(() => setMembershipInfo(null))
  }, [items, customerInfo?.phone, phone])

  // اگر کاربر سازمانی شد، کوپن را پاک کن
  useEffect(() => {
    if (isOrgMember) {
      setAppliedCoupon(null)
      setCouponCode('')
      setCouponError(null)
    }
  }, [isOrgMember])

  const [tableAutoDetected, setTableAutoDetected] = useState(false)

  useEffect(() => {
    const tableFromUrl = searchParams.get('table')
    if (tableFromUrl) {
      setTableNumber(tableFromUrl)
      setTableAutoDetected(true)
      try { sessionStorage.setItem('cafe-park-table', tableFromUrl) } catch {}
      return
    }
    try {
      const savedTable = sessionStorage.getItem('cafe-park-table')
      if (savedTable) { setTableNumber(savedTable); setTableAutoDetected(true) }
    } catch {}
  }, [searchParams])

  useEffect(() => {
    if (items.length === 0 && !submitted) router.replace('/cart')
  }, [items.length, router, submitted])

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: couponCode.trim().toUpperCase(), 
          subtotal: totalPrice,
          items: items.map(i => ({ product_id: i.productId, quantity: i.quantity, unit_price: i.unitPrice }))
        })
      })
      const data = await res.json()
      
      if (!res.ok || !data.success) {
        setCouponError(data.error || 'کد تخفیف معتبر نیست')
        return
      }
      
      setAppliedCoupon({ 
        code: data.coupon.code, 
        discount: data.discount 
      })
      setCouponCode('')
    } catch {
      setCouponError('خطا در بررسی کد تخفیف')
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError(null)
  }

  if (items.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)

    try {
      if (!name.trim()) throw new Error('نام رو وارد کن')
      const cleanPhone = toLatinDigits(phone).replace(/\D/g, '')
      if (cleanPhone.length < 10) throw new Error('شماره تماس معتبر نیست')
      if (!tableNumber && !allTakeaway) throw new Error('شماره میز رو وارد کن')

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: cleanPhone,
          table_number: allTakeaway ? null : (tableNumber ? Number(tableNumber) : null),
          payment_method: paymentMethod,
          note: note.trim() || null,
          items: items.map((item) => ({ product_id: item.productId, product_name: item.productName, option_id: item.selectedOptionId, option_name: item.selectedOptionName, group_name: item.selectedGroupName, unit_price: item.unitPrice, quantity: item.quantity, takeaway: item.takeaway === true })),
          subtotal: finalTotal,
          original_subtotal: totalPrice + takeawayTotal,
          coupon_code: !isOrgMember && appliedCoupon ? appliedCoupon.code : null,
          coupon_discount: !isOrgMember && couponDiscount > 0 ? couponDiscount : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در ثبت سفارش')
      const orderId = data.order.id

      try { sessionStorage.setItem(`cafe-park-order-success-${orderId}`, '1') } catch {}
      setSubmitted(true); clearCart()

      if (paymentMethod === 'online') {
        const payRes = await fetch('/api/payment/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) })
        const payData = await payRes.json()
        if (!payRes.ok || !payData.paymentUrl) {
          try { sessionStorage.setItem(`cafe-park-order-success-${orderId}`, '1') } catch {}
          window.location.href = `/order/${orderId}?payment_error=${encodeURIComponent(payData.error || 'خطا')}`
          return
        }
        window.location.href = payData.paymentUrl
        return
      }

      if (paymentMethod === 'wallet') {
        const payRes = await fetch('/api/payment/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })
        const payData = await payRes.json()
        if (!payRes.ok) {
          try { sessionStorage.setItem(`cafe-park-order-success-${orderId}`, '1') } catch {}
          window.location.href = `/order/${orderId}?payment_error=${encodeURIComponent(payData.error || 'پرداخت با کیف پول ناموفق بود')}`
          return
        }
        window.location.href = `/order/${orderId}`
        return
      }

      await fetch('/api/payment/set-method', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, method: paymentMethod }) })
      window.location.href = `/order/${orderId}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت سفارش')
      setSaving(false)
    }
  }

  const availableMethods: PaymentMethod[] = []
  if (paymentSettings?.payment_enabled) {
    const belowMin = finalTotal < (paymentSettings.payment_min_online_amount || 0)
    if (paymentSettings.payment_online_enabled && !belowMin) availableMethods.push('online')
    if (paymentSettings.payment_cash_enabled || paymentSettings.payment_card_enabled) availableMethods.push('cash')
    if (paymentSettings.payment_transfer_enabled) availableMethods.push('transfer')
    // کیف پول تا وقتی نشست شناسایی‌شده وجود دارد نمایش داده می‌شود؛
    // اگر موجودی کافی نباشد غیرفعال می‌شود (نه اینکه کلاً پنهان باشد).
    if (paymentSettings.payment_wallet_enabled && walletAvailable) availableMethods.push('wallet')
  }
  if (availableMethods.length === 0) availableMethods.push('cash')
  if (!availableMethods.includes(paymentMethod)) setPaymentMethod(availableMethods[0])

  const METHOD_INFO: Record<PaymentMethod, { icon: string; title: string; hint: string }> = {
    online: { icon: '💳', title: 'پرداخت آنلاین', hint: 'با کارت بانکی' },
    cash: { icon: '💵', title: 'پرداخت در محل', hint: 'نقدی یا کارت‌خوان' },
    card: { icon: '💳', title: 'کارت‌خوان', hint: 'پرداخت حضوری' },
    transfer: { icon: '🏦', title: 'کارت به کارت', hint: 'واریز + آپلود رسید' },
    wallet: { icon: '👛', title: 'کیف پول', hint: 'پرداخت از موجودی کیف پول' },
  }

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <Link href="/cart" className="cart-back">← بازگشت به سبد</Link>
        <h1>ثبت سفارش</h1>
        <span style={{ width: 80 }} />
      </header>

      <form onSubmit={handleSubmit} className="checkout-form">
        
        {customerInfo && (
          <div style={{ padding: '16px', borderRadius: '12px', background: '#fffdf9', border: '1px solid #d99f59', marginBottom: '16px', textAlign: 'center' }}>
            <strong style={{ fontSize: '16px', color: '#6b4f3a', display: 'block', marginBottom: '4px' }}>خوش اومدی، {customerInfo.name} عزیز! 🌟</strong>
            {customerInfo.phone && (
              <small style={{ color: '#766f64', fontSize: '13px' }}>
                شماره تماس شما: <span dir="ltr">{customerInfo.phone}</span>
              </small>
            )}
            {walletAvailable && (
              <small style={{ display: 'block', color: '#2d5d3e', fontSize: '13px', fontWeight: 700, marginTop: '6px' }}>
                👛 موجودی کیف پول: {formatPrice(walletBalance as number)} تومان
              </small>
            )}
          </div>
        )}

        {isOrgMember && (
          <div style={{ padding: '12px', borderRadius: '10px', background: (membershipInfo?.discount || 0) > 0 ? '#e5f0e6' : '#fde8e6', color: (membershipInfo?.discount || 0) > 0 ? '#2d5d3e' : '#9b3c32', fontSize: '13px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
            {(membershipInfo?.discount || 0) > 0 
              ? `🎉 کاربر گرامی، سفارش شما به عنوان عضو ${membershipInfo?.orgName} شامل تخفیف ویژه است.`
              : `⚠️ ${membershipInfo?.message || 'سقف تخفیف شما پر شده است.'}`
            }
          </div>
        )}

                <div className="checkout-card">
          <div className="checkout-card-title">
            {allTakeaway ? '🥡 سرویس بیرون‌بر است' : '🪑 محل سرویس'}
          </div>
          {!allTakeaway && (
            <div className="checkout-field">
              <label htmlFor="table">
                شماره میز *
                {tableAutoDetected && (
                  <span style={{ fontSize: '11px', color: '#477052', fontWeight: 500, marginInlineStart: '8px' }}>
                    ✅ از QR تشخیص داده شد
                  </span>
                )}
              </label>
              <input
                id="table"
                type="number"
                value={tableNumber}
                onChange={(e) => {
                  setTableNumber(e.target.value)
                  setTableAutoDetected(false)
                  try { if (e.target.value) sessionStorage.setItem('cafe-park-table', e.target.value) } catch {}
                }}
                placeholder="مثلاً ۵"
                min="1"
                required
                disabled={saving}
              />
            </div>
          )}
          <div className="checkout-field"><label htmlFor="note">توضیحات (اختیاری)</label><textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: قند جدا، بدون شکر..." rows={2} disabled={saving} /></div>
        </div>


        <div className="checkout-card">
          <div className="checkout-card-title">🧾 خلاصه سفارش ({formatPrice(totalItems)} قلم)</div>
          <ul className="checkout-items">
            {items.map((item) => {
              const isEligible = isOrgMember && membershipInfo?.eligibleProductIds?.includes(item.productId)
              const itemTotal = item.unitPrice * item.quantity
              const discountPerItem = isEligible ? Math.round((itemTotal * (membershipInfo?.discountPercent || 0)) / 100) : 0
              const finalItemTotal = itemTotal - discountPerItem

              return (
                <li key={item.id} className={`checkout-item ${isEligible ? 'item-eligible' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                  <div style={{ flex: 1, paddingInlineEnd: '10px' }}>
                    <span style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      {formatPrice(item.quantity)} × {item.productName}
                      {item.selectedOptionName && <small style={{ fontWeight: 'normal', color: '#766f64' }}> ({item.selectedOptionName})</small>}
                      {item.takeaway && <small style={{ fontWeight: 'normal', color: '#766f64' }}> 🥡 بیرون‌بر</small>}

                    </span>
                    {isEligible && (
                      <span className="item-badge badge-eligible" style={{ display: 'inline-block', padding: '2px 8px', fontSize: '11px', background: '#e5f0e6', color: '#2d5d3e', borderRadius: '4px' }}>
                        ✅ شامل {membershipInfo?.discountPercent}٪ تخفیف ({formatPrice(discountPerItem)} تومان)
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'left', minWidth: '90px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    {isEligible ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: '#aaa', fontSize: '11px' }}>{formatPrice(itemTotal)}</span>
                        <span style={{ color: '#2d5d3e', fontWeight: '800', fontSize: '14px' }}>{formatPrice(finalItemTotal)}</span>
                      </>
                    ) : (
                      <span className="checkout-item-price" style={{ fontWeight: '800' }}>{formatPrice(itemTotal)}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* ✅ بخش کد تخفیف: فقط برای مشتریان عادی */}
        {!isOrgMember && (
          <div className="checkout-card">
            <div className="checkout-card-title">🎟️ کد تخفیف</div>
            {appliedCoupon ? (
              <div className="coupon-applied">
                <div className="coupon-applied-info">
                  <span className="coupon-applied-code">{appliedCoupon.code}</span>
                  <small>تخفیف: {formatPrice(appliedCoupon.discount)} تومان</small>
                </div>
                <button 
                  type="button" 
                  className="coupon-remove-btn" 
                  onClick={handleRemoveCoupon}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="coupon-input-row">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleApplyCoupon()
                    }
                  }}
                  placeholder="کد تخفیف را وارد کنید"
                  disabled={couponLoading || saving}
                  dir="ltr"
                />
                <button
                  type="button"
                  className="coupon-apply-btn"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim() || saving}
                >
                  {couponLoading ? '...' : 'اعمال'}
                </button>
              </div>
            )}
            {couponError && <div className="coupon-error">{couponError}</div>}
          </div>
        )}

                {!loadingUser && (!customerInfo || !customerInfo.phone) && (
          <div className="checkout-card">
            <div className="checkout-card-title">📋 اطلاعات شما</div>
            {!customerInfo && (
              <div className="checkout-field"><label>نام و نام خانوادگی *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" disabled={saving} /></div>
            )}
            <div className="checkout-field"><label>شماره تماس *</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" inputMode="tel" dir="ltr" disabled={saving} /></div>
          </div>
        )}


        {!settingsLoading && (
          <div className="checkout-card">
            <div className="checkout-card-title">💳 روش پرداخت</div>
            {gradeInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: '#fdf6e3', border: `1px solid ${gradeInfo.color ?? '#d99f59'}`, borderRadius: '10px', padding: '8px 12px', marginBottom: '10px', fontSize: '11.5px', color: '#6b4f3a' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: gradeInfo.color ?? '#6b4f3a', flex: '0 0 auto' }} />
                🏆 گرید {gradeInfo.name}: {formatPrice(gradeInfo.discountPercent)}٪ تخفیف روی اقلام مشمول — در ثبت نهایی خودکار اعمال می‌شود
              </div>
            )}
            {subInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: '#f7f1ff', border: '1px solid #8f6bc4', borderRadius: '10px', padding: '8px 12px', marginBottom: '10px', fontSize: '11.5px', color: '#4a2c73' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8f6bc4', flex: '0 0 auto' }} />
                ⭐ اشتراک {subInfo.planName}: {formatPrice(subInfo.discountPercent)}٪ تخفیف روی اقلام مشمول — در ثبت نهایی خودکار اعمال می‌شود
              </div>
            )}
            <div className="payment-methods-selector" style={{ gap: '8px' }}>
              {availableMethods.map((m) => {
                const info = METHOD_INFO[m]
                const isSelected = paymentMethod === m;
                const isWalletShort = m === 'wallet' && walletShort
                const hint = isWalletShort
                  ? `موجودی: ${formatPrice(walletBalance as number)} تومان — کافی نیست`
                  : info.hint
                return (
                  <button
                    key={m}
                    type="button"
                    className={`payment-method-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod(m)}
                    disabled={saving || isWalletShort}
                    style={{
                      padding: '12px',
                      minHeight: 'auto',
                      border: isSelected ? '2px solid #6b4f3a' : '1px solid #e3ddd2',
                      background: isSelected ? '#f5f0e9' : '#fffdf9',
                      transition: 'all 0.2s ease',
                      opacity: isWalletShort ? 0.55 : 1,
                      cursor: isWalletShort ? 'default' : 'pointer'
                    }}
                  >
                    <div className="payment-method-option-icon" style={{ width: '32px', height: '32px', fontSize: '18px', background: '#fff' }}>{info.icon}</div>
                    <div className="payment-method-option-info">
                      <strong style={{ fontSize: '13px', color: isSelected ? '#6b4f3a' : '#29251f' }}>{info.title}</strong>
                      <small style={{ fontSize: '10px', color: isSelected ? '#766f64' : '#9a9287' }}>{hint}</small>
                    </div>
                    {isSelected && <span className="payment-method-option-check" style={{ background: '#6b4f3a', color: '#fff' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="checkout-card">
          <div className="checkout-card-title">💰 خلاصه نهایی</div>
          
          <div className="checkout-total-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span>جمع اقلام:</span>
            <strong>{formatPrice(totalPrice)} تومان</strong>
          </div>
          
          {takeawayTotal > 0 && (
            <div className="checkout-total-row" style={{ borderBottom: 'none', padding: '8px 0' }}>
              <span>هزینهٔ بیرون‌بر:</span>
              <strong>{formatPrice(takeawayTotal)} تومان</strong>
            </div>
          )}

          {/* ✅ ردیف تخفیف با عنوان داینامیک */}

                    {totalDiscount > 0 && (
            <div className="checkout-total-row discount" style={{ borderBottom: 'none', padding: '8px 0' }}>
              <span style={{ fontWeight: 'bold' }}>
                {isOrgMember
                  ? 'تخفیف باشگاه:'
                  : `تخفیف کد تخفیف (${appliedCoupon?.code || ''}):`}
              </span>
              <strong>− {formatPrice(totalDiscount)} تومان</strong>
            </div>
          )}
          <div className="checkout-total-row final" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '16px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800 }}>قابل پرداخت:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {(subInfo || gradeInfo) && (
  <div style={{ fontSize: '11.5px', color: '#766f64', textAlign: 'center', marginTop: '10px', lineHeight: 1.7 }}>
    {subInfo && (
      <div>⭐ تخفیف اشتراک ({formatPrice(subInfo.discountPercent)}٪) روی اقلام مشمول، در ثبت نهایی اعمال می‌شود.</div>
    )}
    {gradeInfo && (
      <div>🏆 تخفیف گرید ({formatPrice(gradeInfo.discountPercent)}٪) روی اقلام مشمول، در ثبت نهایی اعمال می‌شود.</div>
    )}
    <div style={{ color: '#9b3c32', fontWeight: 600 }}>
      مبلغ نهاییِ کسرشده از کیف پول، کمتر از عدد بالا خواهد بود.
    </div>
  </div>
)}
							{totalDiscount > 0 && (
                <span style={{ textDecoration: 'line-through', color: '#aaa', fontSize: '13px', fontWeight: 'normal' }}>
                  {formatPrice(totalPrice + takeawayTotal)}
                </span>
              )}
              <strong style={{ fontSize: '22px', color: '#6b4f3a' }}>
                {formatPrice(finalTotal)} <small>تومان</small>
              </strong>
            </div>
          </div>
        </div>

        {error && <div className="checkout-error">❌ {error}</div>}
        
        <button type="submit" className="checkout-btn" disabled={saving}>
          {saving ? 'در حال پردازش...' : paymentMethod === 'online' ? `💳 پرداخت ${formatPrice(finalTotal)} تومان` : '✅ ثبت سفارش'}
        </button>
      </form>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="checkout-page">در حال بارگذاری...</div>}>
      <CheckoutForm />
    </Suspense>
  )
}