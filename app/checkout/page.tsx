'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) => new Intl.NumberFormat('fa-IR').format(Math.round(price))
const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

type PaymentMethod = 'online' | 'cash' | 'card' | 'transfer' | 'wallet'
type PaymentSettings = { payment_enabled: boolean; payment_online_enabled: boolean; payment_cash_enabled: boolean; payment_card_enabled: boolean; payment_transfer_enabled: boolean; payment_wallet_enabled: boolean; payment_min_online_amount: number; payment_transfer_bank_name: string | null; payment_transfer_account_number: string | null; payment_transfer_card_number: string | null; payment_transfer_account_holder: string | null; payment_transfer_requires_review: boolean }
// 🎯 تخفیف فعال موتور تخفیف — آینه‌ی تصمیم سرور (بدون محاسبه‌ی مبلغ سمت کلاینت)
type EngineDiscount = { source: 'org' | 'subscription' | 'grade' | 'stacked-org' | 'stacked-sub'; label: string; percent: number; color: string | null; orgName: string | null; planName: string | null; gradeName: string | null }

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
  // 🎯 پچ ۳۹: تیک اختیاری «استفاده از موجودی کیف پول» — مشتری حق انتخاب دارد که خرجش کند یا نه
  const [useWalletPart, setUseWalletPart] = useState(true)
  // 🏆→🎯 قبلاً گرید و اشتراک جدا نشان داده می‌شدند؛ از پچ ۳۷ فقط تصمیم نهایی موتور نمایش داده می‌شود
  const [activeEngine, setActiveEngine] = useState<EngineDiscount | null>(null)

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
  // 🎯 پچ ۳۹: استفاده از موجودی کیف پول اختیاری (تیک) و مستقل از روش پرداخت —
  // بخش موجودی کسر می‌شود و باقی‌مانده به هر روشی که کاربر انتخاب کند تسویه می‌شود
  const walletPartUsable = walletShort && walletBalance != null && walletBalance > 0
  const walletPart = walletPartUsable && useWalletPart ? Math.min(walletBalance as number, finalTotal) : 0
  const remainderAfterWallet = finalTotal - walletPart

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
      })
      .catch(() => setWalletInfo(null))
  }, [])

  // 🎯 تخفیف فعال — همان تصمیمی که /api/orders هنگام ثبت سفارش می‌گیرد (سازمان×اشتراک → برنده، سپس گرید)
  useEffect(() => {
    fetch('/api/customer/active-discount', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setActiveEngine(data?.active ?? null))
      .catch(() => setActiveEngine(null))
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

      // 🎯 اگر تیک «استفاده از موجودی کیف پول» زده باشد، اول بخش موجودی کسر می‌شود؛
      // اگر کسر ناموفق بود، کل مبلغ به روش انتخابی تسویه می‌شود
      if (walletPart > 0) {
        try {
          await fetch('/api/payment/wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, amount: walletPart }),
          })
        } catch {}
      }

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
        // گزینه کیف پول فقط وقتی موجودی کل مبلغ را پوشاند فعال است؛ کسر کامل باقی‌مانده
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
    // کیف پول فقط وقتی موجودی کل مبلغ را پوشاند در لیست روش‌ها می‌آید (پچ ۳۹b)؛
    // برای خرج کردن بخشی از موجودی، تیک کیف پول بالای همین کارت است.
    if (paymentSettings.payment_wallet_enabled && walletAvailable && !walletShort) availableMethods.push('wallet')
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

      <form onSubmit={handleSubmit} className="checkout-form" id="checkout-form">
        
        {/* 👋 پیام عمومی ثبت سفارش + چیپ کیف پول — بدون تکرار نام و شماره تماس (پچ ۳۷) */}
        <div className="checkout-welcome">
          <strong>در حال ثبت سفارش جدید هستی 👋</strong>
          {walletAvailable && (
            <small className="checkout-wallet-chip">👛 موجودی کیف پول: {formatPrice(walletBalance as number)} تومان</small>
          )}
        </div>

        {/* 🎯 تک‌بنر تخفیف — همان تصمیم موتور تخفیف سرور، با مبلغ وقتی دقیق قابل محاسبه است */}
        {activeEngine && (
          <div className="checkout-discount-banner" style={{ borderColor: activeEngine.color ?? '#6b4f3a', color: activeEngine.color ?? '#6b4f3a' }}>
            <strong>🎉 {activeEngine.label} — {formatPrice(activeEngine.percent)}٪ روی اقلام مشمول</strong>
            {(activeEngine.source === 'org' || activeEngine.source === 'stacked-org') && membershipDiscount > 0 ? (
              <small>تخفیف این سفارش: {formatPrice(membershipDiscount)} تومان — در ثبت نهایی خودکار اعمال می‌شود</small>
            ) : (
              <small>مبلغ دقیق روی اقلام مشمول، در ثبت نهایی خودکار محاسبه و اعمال می‌شود.</small>
            )}
          </div>
        )}
        {!activeEngine && isOrgMember && (
          <div className="checkout-warn-banner">⚠️ {membershipInfo?.message || 'سقف تخفیف شما پر شده است.'}</div>
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
            {walletPartUsable && (
              <div className="checkout-mixed-note">
                <label className="checkout-mixed-toggle">
                  <input
                    type="checkbox"
                    checked={useWalletPart}
                    onChange={(e) => setUseWalletPart(e.target.checked)}
                    disabled={saving}
                  />
                  <span>👛 استفاده از موجودی کیف پول ({formatPrice(walletBalance as number)} تومان)</span>
                </label>
                <small>
                  {useWalletPart
                    ? `با ثبت سفارش، ${formatPrice(walletPart)} تومان از کیف پولت برداشت می‌شود و مابقی (${formatPrice(remainderAfterWallet)} تومان) را به روش انتخابی زیر تسویه می‌کنی.`
                    : 'اگر تیک را بزنی، بخش موجودی از کیف پولت برداشت می‌شود و مابقی را به روش دلخواهت تسویه می‌کنی.'}
                </small>
              </div>
            )}
            {/* 🎯 پچ ۳۹c: انتخابگر فشرده (چیپ) — بدون کارت‌های بلند و بدون مودال اضافه */}
            <div className="payment-methods-selector" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {availableMethods.map((m) => {
                const info = METHOD_INFO[m]
                const isSelected = paymentMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`payment-method-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod(m)}
                    disabled={saving}
                    title={info.hint}
                  >
                    <span className="payment-method-chip-icon">{info.icon}</span>
                    <span>{info.title}</span>
                    {isSelected && <span className="payment-method-chip-check">✓</span>}
                  </button>
                )
              })}
            </div>
            <small className="payment-method-current-hint">{METHOD_INFO[paymentMethod].hint}</small>
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

          {/* ✅ ردیف تخفیف — فقط تخفیف‌هایی که مبلغشان همینجا دقیق مشخص است */}

                    {totalDiscount > 0 && (
            <div className="checkout-total-row discount" style={{ borderBottom: 'none', padding: '8px 0' }}>
              <span style={{ fontWeight: 'bold' }}>
                {isOrgMember
                  ? (activeEngine ? `${activeEngine.label}:` : 'تخفیف باشگاه:')
                  : `تخفیف کد تخفیف (${appliedCoupon?.code || ''}):`}
              </span>
              <strong>− {formatPrice(totalDiscount)} تومان</strong>
            </div>
          )}

          {/* 🎯 پچ ۳۹c: ردیف برداشت کیف پول — شرح شفاف پرداخت */}
          {walletPart > 0 && (
            <div className="checkout-total-row" style={{ borderBottom: 'none', padding: '8px 0' }}>
              <span>👛 برداشت از کیف پول:</span>
              <strong>− {formatPrice(walletPart)} تومان</strong>
            </div>
          )}

          {/* تخفیف اشتراک/گرید: مبلغ دقیق فقط سمت سرور روی اقلام مشمول محاسبه می‌شود */}
          {activeEngine && activeEngine.source !== 'org' && activeEngine.source !== 'stacked-org' && (
            <div className="checkout-engine-note">
              ⏳ {activeEngine.label} ({formatPrice(activeEngine.percent)}٪) روی اقلام مشمول، در ثبت نهایی خودکار اعمال می‌شود.
            </div>
          )}

          <div className="checkout-total-row final" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '16px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800 }}>{walletPart > 0 ? 'مبلغ مانده (قابل پرداخت):' : 'قابل پرداخت:'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {totalDiscount > 0 && (
                <span style={{ textDecoration: 'line-through', color: '#aaa', fontSize: '13px', fontWeight: 'normal' }}>
                  {formatPrice(totalPrice + takeawayTotal)}
                </span>
              )}
              <strong style={{ fontSize: '22px', color: '#6b4f3a' }}>
                {formatPrice(remainderAfterWallet)} <small>تومان</small>
              </strong>
            </div>
          </div>
        </div>

        {error && <div className="checkout-error">❌ {error}</div>}
      </form>

      {/* ✅ نوار پایینی چسبان — مبلغ مانده (بعد از برداشت کیف پول) + دکمه ثبت */}
      <div className="checkout-bottom-bar">
        <div className="checkout-bottom-total">
          <span>{walletPart > 0 ? 'مبلغ مانده' : 'قابل پرداخت'}</span>
          <strong>{formatPrice(remainderAfterWallet)} <small>تومان</small></strong>
        </div>
        <button type="submit" form="checkout-form" className="checkout-btn" disabled={saving}>
          {saving ? 'در حال پردازش...' : paymentMethod === 'online' ? `💳 پرداخت ${formatPrice(remainderAfterWallet)} تومان` : '✅ ثبت سفارش'}
        </button>
      </div>
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