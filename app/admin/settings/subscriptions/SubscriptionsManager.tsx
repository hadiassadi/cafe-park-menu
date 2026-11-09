'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listPlans,
  savePlan,
  deletePlan,
  saveSubscriptionFlags,
  type AdminPlan,
  type AdminSubscriptionRow,
  type SubscriptionFlagsForm,
} from './actions'
import {
  durationLabel,
  planInputError,
  subscriptionSourceLabel,
  subscriptionStatusLabel,
  formatEndsAt,
} from '@/lib/subscriptions/plans'

type DraftPlan = {
  id: string | null
  name: string
  price: string
  duration_days: string
  discount_percent: string
  benefits: string
  sort_order: string
  is_active: boolean
}

const EMPTY_DRAFT: DraftPlan = {
  id: null,
  name: '',
  price: '100000',
  duration_days: '30',
  discount_percent: '5',
  benefits: '',
  sort_order: '10',
  is_active: true,
}

const formatPrice = (n: number) => new Intl.NumberFormat('fa-IR').format(n)

export default function SubscriptionsManager() {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [flags, setFlags] = useState<SubscriptionFlagsForm | null>(null)
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([])
  const [draft, setDraft] = useState<DraftPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const result = await listPlans()
    if (result.error) setError(result.error)
    else {
      setPlans(result.plans ?? [])
      setFlags(result.flags ?? null)
      setSubscriptions(result.subscriptions ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  function flash(text: string) {
    setMessage(text)
    setTimeout(() => setMessage(null), 3000)
  }

  async function handleSaveDraft() {
    if (!draft) return
    setSaving(true)
    setError(null)
    const input = {
      id: draft.id,
      name: draft.name,
      price: Number(draft.price.replace(/[^\d-]/g, '')),
      duration_days: Number(draft.duration_days.replace(/[^\d-]/g, '')),
      discount_percent: Number(draft.discount_percent.replace(/[^\d-]/g, '')),
      benefits: draft.benefits,
      sort_order: Number(draft.sort_order.replace(/[^\d-]/g, '')),
      is_active: draft.is_active,
    }
    const vErr = planInputError(input)
    if (vErr) {
      setError(vErr)
      setSaving(false)
      return
    }
    const result = await savePlan(input)
    if (result.error) setError(result.error)
    else {
      setDraft(null)
      flash('✅ پلن ذخیره شد')
      await refresh()
    }
    setSaving(false)
  }

  async function handleDelete(p: AdminPlan) {
    if (!window.confirm(`پلن «${p.name}» حذف شود؟`)) return
    setSaving(true)
    setError(null)
    const result = await deletePlan(p.id)
    if (result.error) setError(result.error)
    else {
      flash('🗑️ پلن حذف شد')
      await refresh()
    }
    setSaving(false)
  }

  async function handleSaveFlags() {
    if (!flags) return
    setSaving(true)
    setError(null)
    const result = await saveSubscriptionFlags(flags)
    if (result.error) setError(result.error)
    else flash('✅ تنظیمات ذخیره شد')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="admin-main">
        <div className="admin-header">
          <div>
            <h1>⭐ اشتراک ماهیانه</h1>
            <p className="admin-subtitle">در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-main payment-settings-page">
      <div className="admin-header">
        <div>
          <h1>⭐ اشتراک ماهیانه</h1>
          <p className="admin-subtitle">
            پلن تخفیف ماهیانه؛ خرید با کیف پول یا تأیید رسید کارت‌به‌کارت از صف «کیف پول مشتریان»
          </p>
        </div>
        <Link href="/admin/settings" className="btn">← تنظیمات</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">❌ {error}</div>}

      {/* ───── سوییچ سراسری ───── */}
      <section className="admin-card payment-section">
        <div className="payment-section-header-static">
          <div className="payment-section-icon">🔀</div>
          <div>
            <h2 className="payment-section-title">وضعیت اشتراک ماهیانه</h2>
            <p className="payment-section-hint">
              خاموش بودن سوییچ، بخش خرید اشتراک در پنل مشتری و چک‌اوت مخفی می‌شود؛ اشتراک‌های فعال تخفیفشان ادامه دارد
            </p>
          </div>
        </div>

        {flags && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginTop: '8px', borderRadius: '10px', border: `1.5px solid ${flags.subscription_enabled ? '#2e7d32' : '#e5e0da'}`, background: flags.subscription_enabled ? '#e6f6ea' : '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={flags.subscription_enabled}
                onChange={(e) => setFlags({ ...flags, subscription_enabled: e.target.checked })}
              />
              <span style={{ fontSize: '13px' }}>
                <strong>خرید اشتراک فعال است</strong>
                <small style={{ display: 'block', color: '#766f64', fontSize: '11.5px' }}>
                  مشتری می‌تواند از پنل خودش پلن بخرد (کیف پول یا کارت‌به‌کارت)
                </small>
              </span>
            </label>
            <div className="payment-save-bar">
              <button type="button" className="btn primary-btn" onClick={handleSaveFlags} disabled={saving}>
                {saving ? '...' : '💾 ذخیره'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ───── لیست پلن‌ها ───── */}
      <section className="admin-card payment-section">
        <div className="payment-section-header-static">
          <div className="payment-section-icon">📋</div>
          <div>
            <h2 className="payment-section-title">پلن‌ها ({plans.length.toLocaleString('fa-IR')})</h2>
            <p className="payment-section-hint">
              تخفیف اشتراک روی اقلام مشمول (فلگ «بدون تخفیف» محترم است) اعمال می‌شود
            </p>
          </div>
        </div>

        {plans.length === 0 && (
          <p className="empty-admin">هنوز پلنی ثبت نشده است.</p>
        )}

        {plans.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              padding: '10px 12px', marginTop: '8px', borderRadius: '10px',
              border: '1px solid #e5e0da', background: '#fff',
              opacity: p.is_active ? 1 : 0.55,
            }}
          >
            <strong style={{ fontSize: '13px', minWidth: '80px' }}>
              ⭐ {p.name}
              {!p.is_active && <small style={{ color: '#9b3c32' }}> (غیرفعال)</small>}
            </strong>
            <small style={{ color: '#766f64', fontSize: '11.5px' }}>
              {formatPrice(p.price)} تومان · {durationLabel(p.duration_days)} · {formatPrice(p.discount_percent)}٪ تخفیف
              {p.benefits ? ` · ${p.benefits.slice(0, 40)}` : ''}
            </small>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn"
              onClick={() =>
                setDraft({
                  id: p.id,
                  name: p.name,
                  price: String(p.price),
                  duration_days: String(p.duration_days),
                  discount_percent: String(p.discount_percent),
                  benefits: p.benefits ?? '',
                  sort_order: String(p.sort_order),
                  is_active: p.is_active,
                })
              }
              disabled={saving}
            >
              ✏️ ویرایش
            </button>
            <button type="button" className="btn btn-cancel" onClick={() => handleDelete(p)} disabled={saving}>
              🗑️
            </button>
          </div>
        ))}

        {/* فرم افزودن/ویرایش */}
        {draft ? (
          <div style={{ marginTop: '14px', padding: '12px', border: '1.5px solid #d8d0c4', borderRadius: '10px', background: '#fbf9f5' }}>
            <strong style={{ fontSize: '13px' }}>
              {draft.id ? `✏️ ویرایش «${draft.name}»` : '➕ پلن جدید'}
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginTop: '10px' }}>
              <div className="field">
                <label>نام پلن</label>
                <input value={draft.name} maxLength={60} placeholder="ماهانه" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="field">
                <label>قیمت (تومان)</label>
                <input type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              </div>
              <div className="field">
                <label>مدت (روز)</label>
                <input type="number" min="1" max="3650" value={draft.duration_days} onChange={(e) => setDraft({ ...draft, duration_days: e.target.value })} />
              </div>
              <div className="field">
                <label>درصد تخفیف</label>
                <input type="number" min="0" max="100" value={draft.discount_percent} onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value })} />
              </div>
              <div className="field">
                <label>ترتیب نمایش</label>
                <input type="number" min="0" max="999" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} />
              </div>
              <div className="field">
                <label>وضعیت</label>
                <select value={draft.is_active ? '1' : '0'} onChange={(e) => setDraft({ ...draft, is_active: e.target.value === '1' })}>
                  <option value="1">فعال</option>
                  <option value="0">غیرفعال</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>مزایا (اختیاری — برای نمایش به مشتری)</label>
                <textarea
                  value={draft.benefits}
                  maxLength={300}
                  rows={2}
                  placeholder="مثلاً: دسر هدیه در هر سفارش، صندلی اولویت‌دار"
                  onChange={(e) => setDraft({ ...draft, benefits: e.target.value })}
                />
              </div>
            </div>
            <div className="payment-save-bar">
              <button type="button" className="btn primary-btn" onClick={handleSaveDraft} disabled={saving}>
                {saving ? '...' : '💾 ذخیره پلن'}
              </button>
              <button type="button" className="btn" onClick={() => setDraft(null)} disabled={saving}>
                انصراف
              </button>
            </div>
          </div>
        ) : (
          <div className="payment-save-bar">
            <button type="button" className="btn primary-btn" onClick={() => setDraft({ ...EMPTY_DRAFT })} disabled={saving}>
              ➕ افزودن پلن
            </button>
          </div>
        )}
      </section>

      {/* ───── اشتراک‌های اخیر ───── */}
      <section className="admin-card payment-section">
        <div className="payment-section-header-static">
          <div className="payment-section-icon">👥</div>
          <div>
            <h2 className="payment-section-title">اشتراک‌های اخیر ({subscriptions.length.toLocaleString('fa-IR')})</h2>
            <p className="payment-section-hint">۵۰ ردیف آخر — انقضای خودکار با تاریخ پایان</p>
          </div>
        </div>

        {subscriptions.length === 0 && (
          <p className="empty-admin">هنوز اشتراکی خریداری نشده است.</p>
        )}

        {subscriptions.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              padding: '10px 12px', marginTop: '8px', borderRadius: '10px',
              border: '1px solid #e5e0da', background: '#fff',
              opacity: s.status === 'active' ? 1 : 0.55,
            }}
          >
            <strong style={{ fontSize: '13px' }}>⭐ {s.plan_name}</strong>
            <small style={{ color: '#766f64', fontSize: '11.5px' }}>
              {s.customer_name || '—'}
              {s.customer_phone && <span dir="ltr"> · {s.customer_phone}</span>}
              {' · '}{formatPrice(s.discount_percent)}٪ تخفیف
              {' · '}{formatPrice(s.price_paid)} تومان
              {s.status === 'active' ? ` · فعال تا ${formatEndsAt(s.ends_at)}` : ` · ${subscriptionStatusLabel(s.status)}`}
              {' · '}{subscriptionSourceLabel(s.source)}
            </small>
            {s.customer_phone && (
              <Link
                href={`/admin/customers?phone=${encodeURIComponent(s.customer_phone)}`}
                className="btn"
                style={{ textDecoration: 'none' }}
              >
                👤 پرونده
              </Link>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
