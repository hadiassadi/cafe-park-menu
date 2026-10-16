'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getPaymentSettings,
  updatePaymentSettings,
  type PaymentSettings,
} from './actions'

const GATEWAY_OPTIONS = [
  { value: 'zarinpal', label: 'زرین‌پال', icon: '💳' },
  { value: 'idpay', label: 'آیدی‌پی', icon: '💳' },
  { value: 'nextpay', label: 'نکست‌پی', icon: '💳' },
]

export default function PaymentSettingsManager() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // بارگذاری تنظیمات
  useEffect(() => {
    async function load() {
      const result = await getPaymentSettings()
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setSettings(result.data)
      }
      setLoading(false)
    }
    load()
  }, [])

  function update<K extends keyof PaymentSettings>(
    key: K,
    value: PaymentSettings[K]
  ) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setMessage(null)
    setError(null)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    setError(null)

    const result = await updatePaymentSettings(settings)

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
            <h1>💳 تنظیمات پرداخت</h1>
            <p className="admin-subtitle">در حال بارگذاری...</p>
          </div>
        </div>
        <div className="admin-card">
          <p className="empty-admin">⏳ در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="admin-main">
        <div className="admin-header">
          <div>
            <h1>💳 تنظیمات پرداخت</h1>
          </div>
        </div>
        <div className="admin-card">
          <p className="empty-admin">
            ❌ {error || 'خطا در بارگذاری تنظیمات'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-main payment-settings-page">
      {/* هدر */}
      <div className="admin-header">
        <div>
          <h1>💳 تنظیمات پرداخت</h1>
          <p className="admin-subtitle">
            مدیریت روش‌های پرداخت و درگاه‌های آنلاین
          </p>
        </div>
        <Link href="/admin/settings" className="btn">
          ← تنظیمات
        </Link>
      </div>

      {/* پیام‌ها */}
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">❌ {error}</div>}

      {/* ═══════════ ۱. کلید اصلی ═══════════ */}
      <section className="admin-card payment-section">
        <div className="payment-section-header">
          <div className="payment-section-icon">🔘</div>
          <div>
            <h2 className="payment-section-title">سیستم پرداخت</h2>
            <p className="payment-section-hint">
              وقتی خاموش باشه، همه سفارش‌ها فقط با «پرداخت نقدی» ثبت می‌شن
            </p>
          </div>
          <button
            type="button"
            className={`auto-switch ${settings.payment_enabled ? 'on' : 'off'}`}
            onClick={() =>
              update('payment_enabled', !settings.payment_enabled)
            }
            disabled={saving}
            aria-label="فعال/غیرفعال کردن پرداخت"
          >
            <span className="auto-switch-track">
              <span className="auto-switch-thumb" />
            </span>
          </button>
        </div>

        {!settings.payment_enabled && (
          <div className="payment-warning">
            ⚠️ سیستم پرداخت خاموشه. تنظیمات زیر اعمال نمی‌شن تا کلید اصلی روشن
            شه.
          </div>
        )}
      </section>

      {/* ═══════════ ۲. روش‌های پرداخت ═══════════ */}
      <section className="admin-card payment-section">
        <div className="payment-section-header-static">
          <div className="payment-section-icon">💰</div>
          <div>
            <h2 className="payment-section-title">روش‌های پرداخت</h2>
            <p className="payment-section-hint">
              مشتری‌ها می‌تونن از این روش‌ها انتخاب کنن
            </p>
          </div>
        </div>

        <div className="payment-methods-grid">
          {/* آنلاین */}
          <div
            className={`payment-method-card ${
              settings.payment_online_enabled ? 'active' : ''
            } ${!settings.payment_enabled ? 'disabled' : ''}`}
          >
            <div className="payment-method-icon">💳</div>
            <div className="payment-method-info">
              <strong>پرداخت آنلاین</strong>
              <small>زرین‌پال / آیدی‌پی</small>
            </div>
            <button
              type="button"
              className={`auto-switch ${
                settings.payment_online_enabled ? 'on' : 'off'
              }`}
              onClick={() =>
                update(
                  'payment_online_enabled',
                  !settings.payment_online_enabled
                )
              }
              disabled={saving || !settings.payment_enabled}
              aria-label="فعال/غیرفعال پرداخت آنلاین"
            >
              <span className="auto-switch-track">
                <span className="auto-switch-thumb" />
              </span>
            </button>
          </div>

          {/* نقدی */}
          <div
            className={`payment-method-card ${
              settings.payment_cash_enabled ? 'active' : ''
            } ${!settings.payment_enabled ? 'disabled' : ''}`}
          >
            <div className="payment-method-icon">💵</div>
            <div className="payment-method-info">
              <strong>پرداخت نقدی</strong>
              <small>پرداخت در محل</small>
            </div>
            <button
              type="button"
              className={`auto-switch ${
                settings.payment_cash_enabled ? 'on' : 'off'
              }`}
              onClick={() =>
                update(
                  'payment_cash_enabled',
                  !settings.payment_cash_enabled
                )
              }
              disabled={saving || !settings.payment_enabled}
              aria-label="فعال/غیرفعال پرداخت نقدی"
            >
              <span className="auto-switch-track">
                <span className="auto-switch-thumb" />
              </span>
            </button>
          </div>

          {/* کارت‌خوان */}
          <div
            className={`payment-method-card ${
              settings.payment_card_enabled ? 'active' : ''
            } ${!settings.payment_enabled ? 'disabled' : ''}`}
          >
            <div className="payment-method-icon">💳</div>
            <div className="payment-method-info">
              <strong>کارت‌خوان</strong>
              <small>پرداخت با کارت در محل</small>
            </div>
            <button
              type="button"
              className={`auto-switch ${
                settings.payment_card_enabled ? 'on' : 'off'
              }`}
              onClick={() =>
                update(
                  'payment_card_enabled',
                  !settings.payment_card_enabled
                )
              }
              disabled={saving || !settings.payment_enabled}
              aria-label="فعال/غیرفعال کارت‌خوان"
            >
              <span className="auto-switch-track">
                <span className="auto-switch-thumb" />
              </span>
            </button>
          </div>

          {/* واریز بانکی */}
          <div
            className={`payment-method-card ${
              settings.payment_transfer_enabled ? 'active' : ''
            } ${!settings.payment_enabled ? 'disabled' : ''}`}
          >
            <div className="payment-method-icon">🏦</div>
            <div className="payment-method-info">
              <strong>واریز به حساب</strong>
              <small>با آپلود رسید</small>
            </div>
            <button
              type="button"
              className={`auto-switch ${
                settings.payment_transfer_enabled ? 'on' : 'off'
              }`}
              onClick={() =>
                update(
                  'payment_transfer_enabled',
                  !settings.payment_transfer_enabled
                )
              }
              disabled={saving || !settings.payment_enabled}
              aria-label="فعال/غیرفعال واریز بانکی"
            >
              <span className="auto-switch-track">
                <span className="auto-switch-thumb" />
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════ ۳. تنظیمات درگاه آنلاین ═══════════ */}
      {settings.payment_online_enabled && settings.payment_enabled && (
        <section className="admin-card payment-section">
          <div className="payment-section-header-static">
            <div className="payment-section-icon">🔧</div>
            <div>
              <h2 className="payment-section-title">تنظیمات درگاه آنلاین</h2>
              <p className="payment-section-hint">
                اطلاعات درگاه پرداخت اینترنتی
              </p>
            </div>
          </div>

          {/* انتخاب درگاه */}
          <div className="field">
            <label>درگاه پرداخت</label>
            <div className="payment-gateway-options">
              {GATEWAY_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  className={`payment-gateway-option ${
                    settings.payment_gateway === g.value ? 'active' : ''
                  }`}
                  onClick={() => update('payment_gateway', g.value)}
                  disabled={saving}
                >
                  <span className="payment-gateway-option-icon">{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Merchant ID */}
          <div className="field">
            <label>
              Merchant ID
              <span className="payment-required">*</span>
            </label>
            <input
              type="text"
              dir="ltr"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={settings.payment_merchant_id || ''}
              onChange={(e) =>
                update('payment_merchant_id', e.target.value.trim() || null)
              }
              disabled={saving}
            />
            <small>
              کد ۳۶ کاراکتری که از پنل {settings.payment_gateway} دریافت
              می‌کنی
            </small>
          </div>

          {/* حالت تست */}
          <div className="payment-toggle-row">
            <div className="payment-toggle-info">
              <strong>حالت تست (Sandbox)</strong>
              <small>
                توی این حالت، تراکنش‌ها واقعی نیستن و پولی جابجا نمی‌شه
              </small>
            </div>
            <button
              type="button"
              className={`auto-switch ${
                settings.payment_sandbox_mode ? 'on' : 'off'
              }`}
              onClick={() =>
                update(
                  'payment_sandbox_mode',
                  !settings.payment_sandbox_mode
                )
              }
              disabled={saving}
              aria-label="حالت تست"
            >
              <span className="auto-switch-track">
                <span className="auto-switch-thumb" />
              </span>
            </button>
          </div>

          {settings.payment_sandbox_mode && (
            <div className="payment-sandbox-warning">
              🧪 حالت تست فعاله — پول واقعی جابجا نمی‌شه
            </div>
          )}

          {/* حداقل مبلغ */}
          <div className="field">
            <label>حداقل مبلغ برای پرداخت آنلاین (تومان)</label>
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="0 = بدون محدودیت"
              value={settings.payment_min_online_amount || 0}
              onChange={(e) =>
                update(
                  'payment_min_online_amount',
                  Math.max(0, Number(e.target.value) || 0)
                )
              }
              disabled={saving}
            />
            <small>
              اگه مبلغ سفارش کمتر از این عدد باشه، فقط روش‌های حضوری نمایش داده
              می‌شن
            </small>
          </div>
        </section>
      )}

      {/* ═══════════ ۴. تنظیمات واریز بانکی ═══════════ */}
      {settings.payment_transfer_enabled && settings.payment_enabled && (
        <section className="admin-card payment-section">
          <div className="payment-section-header-static">
            <div className="payment-section-icon">🏦</div>
            <div>
              <h2 className="payment-section-title">اطلاعات حساب بانکی</h2>
              <p className="payment-section-hint">
                این اطلاعات به مشتری نمایش داده می‌شه تا واریز کنه
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>نام بانک</label>
              <input
                type="text"
                placeholder="مثلاً: بانک ملی"
                value={settings.payment_transfer_bank_name || ''}
                onChange={(e) =>
                  update(
                    'payment_transfer_bank_name',
                    e.target.value.trim() || null
                  )
                }
                disabled={saving}
              />
            </div>

            <div className="field">
              <label>نام صاحب حساب</label>
              <input
                type="text"
                placeholder="مثلاً: علی احمدی"
                value={settings.payment_transfer_account_holder || ''}
                onChange={(e) =>
                  update(
                    'payment_transfer_account_holder',
                    e.target.value.trim() || null
                  )
                }
                disabled={saving}
              />
            </div>

            <div className="field">
              <label>شماره حساب</label>
              <input
                type="text"
                dir="ltr"
                inputMode="numeric"
                placeholder="1234567890"
                value={settings.payment_transfer_account_number || ''}
                onChange={(e) =>
                  update(
                    'payment_transfer_account_number',
                    e.target.value.trim() || null
                  )
                }
                disabled={saving}
              />
            </div>

            <div className="field">
              <label>شماره کارت</label>
              <input
                type="text"
                dir="ltr"
                inputMode="numeric"
                placeholder="6037-XXXX-XXXX-XXXX"
                value={settings.payment_transfer_card_number || ''}
                onChange={(e) =>
                  update(
                    'payment_transfer_card_number',
                    e.target.value.trim() || null
                  )
                }
                disabled={saving}
              />
            </div>
          </div>

          <div className="payment-toggle-row">
            <div className="payment-toggle-info">
              <strong>نیاز به تأیید ادمین</strong>
              <small>
                رسید آپلود شده باید توسط ادمین تأیید بشه تا سفارش تأیید نهایی
                بشه
              </small>
            </div>
            <button
              type="button"
              className={`auto-switch ${
                settings.payment_transfer_requires_review ? 'on' : 'off'
              }`}
              onClick={() =>
                update(
                  'payment_transfer_requires_review',
                  !settings.payment_transfer_requires_review
                )
              }
              disabled={saving}
              aria-label="نیاز به تأیید"
            >
              <span className="auto-switch-track">
                <span className="auto-switch-thumb" />
              </span>
            </button>
          </div>

          {/* تأیید خودکار با AI — غیرفعال برای حالا */}
          <div className="payment-toggle-row disabled">
            <div className="payment-toggle-info">
              <strong>
                🤖 تأیید خودکار رسید با هوش مصنوعی
                <span className="payment-coming-soon">به‌زودی</span>
              </strong>
              <small>
                تشخیص خودکار مبلغ و اطلاعات رسید با AI — برای فازهای بعدی
              </small>
            </div>
            <button
              type="button"
              className="auto-switch off"
              disabled
              aria-label="به زودی"
            >
              <span className="auto-switch-track">
                <span className="auto-switch-thumb" />
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ═══════════ دکمه ذخیره ═══════════ */}
      <div className="payment-save-bar">
        <button
          type="button"
          className="btn primary-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '...' : '💾 ذخیره تنظیمات'}
        </button>
      </div>
    </div>
  )
}