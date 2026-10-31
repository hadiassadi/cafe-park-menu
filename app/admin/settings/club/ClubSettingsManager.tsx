'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getClubSettings,
  updateClubSettings,
  type ClubSettingsForm,
} from './actions'

export default function ClubSettingsManager() {
  const [s, setS] = useState<ClubSettingsForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const result = await getClubSettings()
      if (result.error) setError(result.error)
      else if (result.data) setS(result.data)
      setLoading(false)
    }
    load()
  }, [])

  function update<K extends keyof ClubSettingsForm>(key: K, value: ClubSettingsForm[K]) {
    if (!s) return
    setS({ ...s, [key]: value })
    setMessage(null)
    setError(null)
  }

  async function handleSave() {
    if (!s) return
    setSaving(true)
    setMessage(null)
    setError(null)
    const result = await updateClubSettings(s)
    if (result.error) {
      setError(result.error)
    } else {
      setMessage('✅ تنظیمات ذخیره شد')
      setTimeout(() => setMessage(null), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="admin-main">
        <div className="admin-header">
          <div>
            <h1>🛡️ قوانین اعتبار</h1>
            <p className="admin-subtitle">در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!s) {
    return (
      <div className="admin-main">
        <div className="admin-header">
          <div><h1>🛡️ قوانین اعتبار</h1></div>
        </div>
        <div className="admin-card">
          <p className="empty-admin">❌ {error || 'خطا در بارگذاری تنظیمات'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-main payment-settings-page">
      <div className="admin-header">
        <div>
          <h1>🛡️ قوانین اعتبار</h1>
          <p className="admin-subtitle">چه کسی می‌تواند نقدی یا با کارت‌خوان پرداخت کند</p>
        </div>
        <Link href="/admin/settings" className="btn">← تنظیمات</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">❌ {error}</div>}

      <section className="admin-card payment-section">
        <div className="payment-section-header-static">
          <div className="payment-section-icon">📋</div>
          <div>
            <h2 className="payment-section-title">شرایط مشتری</h2>
            <p className="payment-section-hint">این قوانین هنگام ثبت سفارش نقدی یا کارت‌خوان بررسی می‌شود</p>
          </div>
        </div>

        <div className="field">
          <label>حداقل سفارش تسویه‌شده</label>
          <input
            type="number"
            min="0"
            max="100"
            value={s.min_settled_orders_for_credit}
            onChange={(e) => update('min_settled_orders_for_credit', Number(e.target.value))}
            disabled={saving}
          />
          <small>مشتری باید این تعداد سفارش تحویل‌شده و پرداخت‌شده داشته باشد</small>
        </div>

        <div className="payment-toggle-row" style={{ marginTop: '16px' }}>
          <div className="payment-toggle-info">
            <strong>اجازه به مشتری بدون سابقه</strong>
            <small>اگر روشن باشد، شرط حداقل سفارش نادیده گرفته می‌شود</small>
          </div>
          <button
            type="button"
            className={`auto-switch ${s.allow_credit_for_new_members ? 'on' : 'off'}`}
            onClick={() => update('allow_credit_for_new_members', !s.allow_credit_for_new_members)}
            disabled={saving}
          >
            <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
          </button>
        </div>

        <div className="payment-toggle-row" style={{ marginTop: '16px' }}>
          <div className="payment-toggle-info">
            <strong>مسدودکردن مشتری بدهکار</strong>
            <small>اگر روشن باشد، مشتری دارای بدهی باز نمی‌تواند پرداخت حضوری انتخاب کند</small>
          </div>
          <button
            type="button"
            className={`auto-switch ${s.block_members_with_debt ? 'on' : 'off'}`}
            onClick={() => update('block_members_with_debt', !s.block_members_with_debt)}
            disabled={saving}
          >
            <span className="auto-switch-track"><span className="auto-switch-thumb" /></span>
          </button>
        </div>

        <div className="field" style={{ marginTop: '16px' }}>
          <label>سقف بدهی باز (تومان)</label>
          <input
            type="number"
            min="0"
            step="10000"
            value={s.max_open_debt}
            onChange={(e) => update('max_open_debt', Number(e.target.value))}
            disabled={saving}
          />
          <small>بدهی بیشتر از این مبلغ، پرداخت حضوری را می‌بندد</small>
        </div>

        <div className="field" style={{ marginTop: '16px' }}>
          <label>حداقل پرداخت جزئی (تومان)</label>
          <input
            type="number"
            min="0"
            step="1000"
            value={s.min_partial_payment}
            onChange={(e) => update('min_partial_payment', Number(e.target.value))}
            disabled={saving}
          />
          <small>کمترین مبلغی که در هر پرداخت جزئی پذیرفته می‌شود</small>
        </div>
      </section>

      <div className="payment-save-bar">
        <button type="button" className="btn primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? '...' : '💾 ذخیره تنظیمات'}
        </button>
      </div>
    </div>
  )
}
