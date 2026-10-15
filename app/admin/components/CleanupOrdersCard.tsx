'use client'

import { useEffect, useState } from 'react'
import {
  cleanupOldOrders,
  countOldOrders,
  getCleanupStatus,
  updateCleanupSettings,
} from '../orders/actions'

type CleanupStatus = {
  enabled: boolean
  days_kept: number
  job_active: boolean
  last_run: {
    status: string
    return_message: string
    start_time: string
    end_time: string
  } | null
}

const AUTO_DAYS_OPTIONS = [30, 60, 90, 180, 365]

const MANUAL_DAYS_OPTIONS = [
  { value: 7, label: 'بیشتر از ۷ روز' },
  { value: 30, label: 'بیشتر از ۳۰ روز' },
  { value: 60, label: 'بیشتر از ۶۰ روز' },
  { value: 90, label: 'بیشتر از ۹۰ روز' },
]

function formatDateTimeFa(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function CleanupOrdersCard() {
  // ─── auto cleanup state ───
  const [autoStatus, setAutoStatus] = useState<CleanupStatus | null>(null)
  const [autoLoading, setAutoLoading] = useState(true)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoMessage, setAutoMessage] = useState<string | null>(null)
  const [autoError, setAutoError] = useState<string | null>(null)

  // ─── manual cleanup state ───
  const [days, setDays] = useState(30)
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ✅ بارگذاری وضعیت پاکسازی خودکار
  useEffect(() => {
    async function load() {
      setAutoLoading(true)
      const result = await getCleanupStatus()
      if (result.error) {
        setAutoError(result.error)
      } else if (result.data) {
        setAutoStatus(result.data)
        setAutoError(null)
      }
      setAutoLoading(false)
    }
    load()
  }, [])

  async function updateAutoSettings(enabled: boolean, days_kept: number) {
    setAutoSaving(true)
    setAutoError(null)
    setAutoMessage(null)

    const result = await updateCleanupSettings(enabled, days_kept)

    if (result.error) {
      setAutoError(result.error)
    } else if (result.data) {
      setAutoStatus(result.data)
      setAutoMessage('✅ ذخیره شد')
      setTimeout(() => setAutoMessage(null), 3000)
    }

    setAutoSaving(false)
  }

  function handleToggleAuto() {
    if (!autoStatus) return
    updateAutoSettings(!autoStatus.enabled, autoStatus.days_kept)
  }

  function handleChangeAutoDays(newDays: number) {
    if (!autoStatus) return
    updateAutoSettings(autoStatus.enabled, newDays)
  }

  // ✅ بارگذاری تعداد سفارش‌های قدیمی (دستی)
  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await countOldOrders(days)
      if (result.error) {
        setError(result.error)
        setCount(null)
      } else {
        setCount(result.count ?? 0)
        setError(null)
      }
      setLoading(false)
    }
    load()
  }, [days])

  async function handleCleanup() {
    setCleaning(true)
    setMessage(null)
    setError(null)

    const result = await cleanupOldOrders(days)

    if (result.error) {
      setError(result.error)
    } else {
      setMessage(result.message || 'پاکسازی انجام شد')
      const newCount = await countOldOrders(days)
      setCount(newCount.count ?? 0)
    }

    setCleaning(false)
    setShowConfirm(false)
    setTimeout(() => setMessage(null), 4000)
  }

  const autoActive = autoStatus?.job_active && autoStatus?.enabled

  return (
    <div className="cleanup-wrapper">
      {/* ═══════════ کارت پاکسازی خودکار ═══════════ */}
      <div className="cleanup-card auto-cleanup-card">
        <div className="cleanup-header">
          <div className="cleanup-icon auto-icon">⚙️</div>
          <div className="cleanup-header-content">
            <strong>پاکسازی خودکار (Cron Job)</strong>
            <small>هر روز ساعت ۳ بامداد به‌صورت خودکار اجرا می‌شه</small>
          </div>
          {autoStatus && (
            <span
              className={`auto-status-badge ${
                autoActive ? 'active' : 'inactive'
              }`}
            >
              {autoActive ? '🟢 فعال' : '🔴 غیرفعال'}
            </span>
          )}
        </div>

        <div className="cleanup-body">
          {autoLoading ? (
            <div className="cleanup-count">⏳ در حال بارگذاری...</div>
          ) : autoError ? (
            <div className="cleanup-count cleanup-error">❌ {autoError}</div>
          ) : autoStatus ? (
            <>
              <div className="auto-toggle-row">
                <div className="auto-toggle-info">
                  <strong>اجرای خودکار</strong>
                  <small>
                    وقتی غیرفعال باشه، پاکسازی خودکار انجام نمی‌شه ولی
                    زمان‌بندی cron معتبر باقی می‌مونه.
                  </small>
                </div>
                <button
                  type="button"
                  className={`auto-switch ${
                    autoStatus.enabled ? 'on' : 'off'
                  }`}
                  onClick={handleToggleAuto}
                  disabled={autoSaving}
                  aria-label="تغییر وضعیت اجرای خودکار"
                >
                  <span className="auto-switch-track">
                    <span className="auto-switch-thumb" />
                  </span>
                </button>
              </div>

              <div className="auto-days-row">
                <label className="cleanup-label">نگهداری سفارش‌ها:</label>
                <select
                  value={autoStatus.days_kept}
                  onChange={(e) =>
                    handleChangeAutoDays(Number(e.target.value))
                  }
                  className="cleanup-select"
                  disabled={autoSaving}
                >
                  {AUTO_DAYS_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} روز
                    </option>
                  ))}
                </select>
              </div>

              <div className="auto-last-run">
                <div className="auto-last-run-title">📅 آخرین اجرا</div>
                {autoStatus.last_run ? (
                  <>
                    <div className="auto-last-run-row">
                      <span>تاریخ:</span>
                      <strong>
                        {formatDateTimeFa(autoStatus.last_run.start_time)}
                      </strong>
                    </div>
                    <div className="auto-last-run-row">
                      <span>وضعیت:</span>
                      <strong
                        className={
                          autoStatus.last_run.status === 'succeeded'
                            ? 'run-success'
                            : 'run-failed'
                        }
                      >
                        {autoStatus.last_run.status === 'succeeded'
                          ? '✅ موفق'
                          : '❌ ' + autoStatus.last_run.status}
                      </strong>
                    </div>
                    <div className="auto-last-run-row auto-last-run-message">
                      <span>نتیجه:</span>
                      <strong>
                        {autoStatus.last_run.return_message || '—'}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="auto-last-run-empty">
                    هنوز اجرایی ثبت نشده — اولین اجرا ساعت ۳ بامداد
                  </div>
                )}
              </div>

              {autoMessage && (
                <div className="cleanup-success">{autoMessage}</div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* ═══════════ کارت پاکسازی دستی ═══════════ */}
      <div className="cleanup-card">
        <div className="cleanup-header">
          <div className="cleanup-icon">🧹</div>
          <div className="cleanup-header-content">
            <strong>پاکسازی دستی سفارش‌های قدیمی</strong>
            <small>حذف فوری سفارش‌های تحویل‌شده و لغو‌شده</small>
          </div>
        </div>

        <div className="cleanup-body">
          <label className="cleanup-label">حذف سفارش‌های:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="cleanup-select"
            disabled={cleaning}
          >
            {MANUAL_DAYS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="cleanup-count">
            {loading ? (
              <span>⏳ در حال شمارش...</span>
            ) : error ? (
              <span className="cleanup-error">❌ {error}</span>
            ) : count === 0 ? (
              <span className="cleanup-empty">
                ✅ سفارش قدیمی‌ای برای حذف وجود ندارد
              </span>
            ) : (
              <span className="cleanup-has-data">
                ⚠️ <strong>{count?.toLocaleString('fa-IR')}</strong> سفارش
                آماده حذف
              </span>
            )}
          </div>

          {message && <div className="cleanup-success">✅ {message}</div>}

          {count !== null && count > 0 && (
            <button
              type="button"
              className="cleanup-btn"
              onClick={() => setShowConfirm(true)}
              disabled={cleaning || loading}
            >
              {cleaning ? '...' : '🧹 پاکسازی کن'}
            </button>
          )}
        </div>
      </div>

      {/* مودال تأیید */}
      {showConfirm && (
        <div
          className="modal-overlay"
          onClick={() => !cleaning && setShowConfirm(false)}
        >
          <div
            className="modal-container modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>تأیید پاکسازی</h2>
                <p>مطمئنی می‌خوای حذف کنی؟</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfirm(false)}
                disabled={cleaning}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p
                style={{
                  fontSize: '13px',
                  color: '#766f64',
                  lineHeight: 1.8,
                }}
              >
                <strong style={{ color: '#9b3c32' }}>
                  {count?.toLocaleString('fa-IR')} سفارش
                </strong>{' '}
                قدیمی‌تر از {days} روز که وضعیت «تحویل شده» یا «لغو شده» دارن،
                به صورت دائمی حذف می‌شن.
                <br />
                <br />
                این عمل قابل بازگشت نیست.
              </p>

              {error && (
                <div className="checkout-error" style={{ marginTop: '12px' }}>
                  ❌ {error}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setShowConfirm(false)}
                disabled={cleaning}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#9b3c32',
                  color: '#fff',
                  border: 0,
                }}
                onClick={handleCleanup}
                disabled={cleaning}
              >
                {cleaning ? '...' : 'بله، حذف کن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}