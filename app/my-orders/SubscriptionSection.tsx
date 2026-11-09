'use client'

import { useCallback, useEffect, useState } from 'react'
import { durationLabel, formatEndsAt, walletPurchaseError } from '@/lib/subscriptions/plans'

/**
 * بخش اشتراک ماهیانه در پنل مشتری:
 * چیپ اشتراک فعال + لیست پلن‌ها با خرید کیف‌پولی یا درخواست کارت‌به‌کارت.
 * خودمختار است — /api/subscription را خودش می‌گیرد تا MyOrdersClient سبک بماند.
 */

type Plan = {
  id: string
  name: string
  price: number
  duration_days: number
  discount_percent: number
  benefits: string | null
  sort_order: number
}

type SubData = {
  subscriptionEnabled: boolean
  plans: Plan[]
  customer: { name: string | null; wallet_blocked: boolean } | null
  subscription: { id: string; plan_name: string; discount_percent: number; ends_at: string } | null
  pendingRequest: { id: string; status: string; plan_name: string | null; reject_reason?: string | null } | null
}

const formatPrice = (n: number) => new Intl.NumberFormat('fa-IR').format(n)

export default function SubscriptionSection({
  balance,
  hasCustomer,
  onStatusChanged,
}: {
  balance: number | null
  hasCustomer: boolean
  onStatusChanged?: () => void
}) {
  const [data, setData] = useState<SubData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [cardForm, setCardForm] = useState<string | null>(null) // plan_id در حال ثبت رسید
  const [tracking, setTracking] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(() => {
    fetch('/api/subscription', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: SubData) => {
        if (d && typeof d.subscriptionEnabled === 'boolean') setData(d)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function buyWithWallet(plan: Plan) {
    if (!window.confirm(`اشتراک «${plan.name}» به قیمت ${formatPrice(plan.price)} تومان از کیف پول خریداری شود؟`)) return
    setBusy(plan.id)
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        flash(false, json?.error || 'خرید ناموفق بود')
      } else {
        flash(true, '✅ اشتراک فعال شد؛ تخفیفش در سفارش‌های بعدی خودکار اعمال می‌شود')
        load()
        onStatusChanged?.()
      }
    } catch {
      flash(false, 'ارتباط با سرور برقرار نشد')
    } finally {
      setBusy(null)
    }
  }

  async function submitCardRequest(plan: Plan) {
    if (!file) {
      flash(false, 'عکس رسید را انتخاب کن')
      return
    }
    setBusy(plan.id)
    try {
      const fd = new FormData()
      fd.append('plan_id', plan.id)
      fd.append('tracking_no', tracking)
      fd.append('file', file)
      const res = await fetch('/api/subscription/request', { method: 'POST', body: fd })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        flash(false, json?.error || 'ثبت درخواست ناموفق بود')
      } else {
        flash(true, 'درخواست ثبت شد؛ بعد از تأیید مدیر، اشتراکت فعال می‌شود')
        setCardForm(null)
        setTracking('')
        setFile(null)
        load()
      }
    } catch {
      flash(false, 'ارتباط با سرور برقرار نشد')
    } finally {
      setBusy(null)
    }
  }

  if (!data) return null

  const sub = data.subscription
  // سوییچ خاموش ولی اشتراکِ فعال → فقط چیپ نشان بده؛ لیست پلن‌ها فقط با سوییچ روشن
  if (!sub && !data.subscriptionEnabled) return null
  if (!sub && (data.plans ?? []).length === 0) return null

  return (
    <div style={{ marginTop: '10px' }}>
      {/* چیپ اشتراک فعال */}
      {sub && (
        <div style={{ background: '#f7f1ff', border: '1.5px solid #8f6bc4', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px' }}>⭐</span>
          <strong style={{ fontSize: '13px', color: '#4a2c73' }}>اشتراک {sub.plan_name}</strong>
          {sub.discount_percent > 0 && (
            <small style={{ fontSize: '11.5px', color: '#766f64' }}>
              {formatPrice(sub.discount_percent)}٪ تخفیف روی اقلام مشمول — خودکار اعمال می‌شود
            </small>
          )}
          <small style={{ fontSize: '11.5px', color: '#766f64' }}>فعال تا {formatEndsAt(sub.ends_at)}</small>
        </div>
      )}

      {/* درخواستِ در انتظار تأیید */}
      {data.pendingRequest && !sub && (
        <div style={{ background: '#fffdf7', border: '1px solid #d9c48a', borderRadius: '12px', padding: '8px 12px', marginTop: '8px', fontSize: '11.5px', color: '#8a6d3b' }}>
          ⏳ درخواست خرید اشتراک{data.pendingRequest.plan_name ? ` «${data.pendingRequest.plan_name}»` : ''} در انتظار تأیید مدیر است.
        </div>
      )}

      {/* لیست پلن‌ها */}
      {data.subscriptionEnabled && !sub && (data.plans ?? []).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e0da', borderRadius: '14px', padding: '12px 14px', marginTop: '8px' }}>
          <strong style={{ fontSize: '13px', color: '#29251f' }}>⭐ اشتراک ماهیانه</strong>
          <small style={{ display: 'block', fontSize: '11.5px', color: '#766f64', marginTop: '2px' }}>
            با اشتراک، روی اقلام مشمول تخفیف ثابت می‌گیری — تا پایان مدت پلن.
          </small>

          {msg && (
            <div style={{ marginTop: '8px', fontSize: '11.5px', padding: '8px 10px', borderRadius: '8px', background: msg.ok ? '#e6f6ea' : '#fdeaea', color: msg.ok ? '#176a32' : '#8f2020' }}>
              {msg.text}
            </div>
          )}

          {data.plans.map((p) => {
            const walletErr = walletPurchaseError({
              balance,
              price: p.price,
              hasActiveSubscription: false,
              subscriptionEnabled: true,
              hasCustomer,
            })
            const pending = data.pendingRequest
            return (
              <div key={p.id} style={{ padding: '10px 12px', marginTop: '8px', borderRadius: '10px', border: '1px solid #e5e0da', background: '#fbf9f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '12.5px' }}>⭐ {p.name}</strong>
                  <small style={{ fontSize: '11px', color: '#766f64' }}>
                    {durationLabel(p.duration_days)} · {formatPrice(p.price)} تومان
                    {p.discount_percent > 0 && ` · ${formatPrice(p.discount_percent)}٪ تخفیف`}
                  </small>
                </div>
                {p.benefits && (
                  <small style={{ display: 'block', fontSize: '11px', color: '#766f64', marginTop: '3px' }}>{p.benefits}</small>
                )}

                {cardForm !== p.id && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => buyWithWallet(p)}
                      disabled={busy === p.id || !!walletErr || !!pending}
                      style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: walletErr ? '#c9c2b6' : '#2d5d3e', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: walletErr || pending ? 'not-allowed' : 'pointer' }}
                    >
                      {busy === p.id ? '…' : '👛 خرید با کیف پول'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCardForm(p.id); setMsg(null) }}
                      disabled={busy === p.id || !!pending}
                      style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d8d0c4', background: '#fff', color: '#6b4f3a', fontSize: 11.5, cursor: pending ? 'not-allowed' : 'pointer' }}
                    >
                      💳 کارت‌به‌کارت
                    </button>
                    <button
                      type="button"
                      disabled
                      title="پرداخت آنلاین به‌زودی فعال می‌شود"
                      style={{ padding: '7px 12px', borderRadius: 8, border: '1px dashed #c9c2b6', background: '#faf8f5', color: '#9b957f', fontSize: 11.5, cursor: 'not-allowed' }}
                    >
                      🌐 آنلاین — به‌زودی
                    </button>
                  </div>
                )}
                {walletErr && cardForm !== p.id && (
                  <small style={{ display: 'block', marginTop: '5px', fontSize: '10.5px', color: '#9b3c32' }}>{walletErr}</small>
                )}
                {pending && cardForm !== p.id && (
                  <small style={{ display: 'block', marginTop: '5px', fontSize: '10.5px', color: '#8a6d3b' }}>
                    درخواستِ در انتظار تأیید داری؛ تا بررسی شدن، نمی‌توانی درخواست جدید بفرستی.
                  </small>
                )}

                {cardForm === p.id && (
                  <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #d8d0c4', background: '#fff' }}>
                    <small style={{ display: 'block', fontSize: '11px', color: '#6b4f3a' }}>
                      {formatPrice(p.price)} تومان واریز کن، بعد شماره پیگیری و عکس رسید را بفرست:
                    </small>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="شماره پیگیری"
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', marginTop: '6px', padding: '8px 10px', borderRadius: 8, border: '1px solid #d8d0c4', fontSize: 12 }}
                    />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      style={{ width: '100%', marginTop: '6px', fontSize: 11 }}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => submitCardRequest(p)}
                        disabled={busy === p.id}
                        style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#2d5d3e', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
                      >
                        {busy === p.id ? '…' : 'ارسال درخواست'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardForm(null)}
                        disabled={busy === p.id}
                        style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d8d0c4', background: '#fff', color: '#6b4f3a', fontSize: 11.5 }}
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
