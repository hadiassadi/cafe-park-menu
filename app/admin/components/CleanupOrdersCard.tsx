'use client'

import { useEffect, useState } from 'react'
import { cleanupOldOrders, countOldOrders } from '../orders/actions'

const DAYS_OPTIONS = [
  { value: 7, label: 'بیشتر از ۷ روز' },
  { value: 30, label: 'بیشتر از ۳۰ روز' },
  { value: 60, label: 'بیشتر از ۶۰ روز' },
  { value: 90, label: 'بیشتر از ۹۰ روز' },
]

export default function CleanupOrdersCard() {
  const [days, setDays] = useState(30)
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ✅ خوندن تعداد سفارش‌های قدیمی
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
      // رفرش تعداد
      const newCount = await countOldOrders(days)
      setCount(newCount.count ?? 0)
    }

    setCleaning(false)
    setShowConfirm(false)

    setTimeout(() => setMessage(null), 4000)
  }

  return (
    <div className="cleanup-card">
      <div className="cleanup-header">
        <div className="cleanup-icon">🧹</div>
        <div className="cleanup-header-content">
          <strong>پاکسازی سفارش‌های قدیمی</strong>
          <small>حذف سفارش‌های تحویل‌شده و لغو‌شده</small>
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
          {DAYS_OPTIONS.map((opt) => (
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
              ⚠️ <strong>{count?.toLocaleString('fa-IR')}</strong> سفارش آماده حذف
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
                <div
                  className="checkout-error"
                  style={{ marginTop: '12px' }}
                >
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