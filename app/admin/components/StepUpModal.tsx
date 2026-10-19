'use client'

import { useState, useEffect } from 'react'

export default function StepUpModal({
  isOpen,
  verifying,
  error,
  onConfirm,
  onClose,
}: {
  isOpen: boolean
  verifying: boolean
  error: string | null
  onConfirm: (password: string) => void
  onClose: () => void
}) {
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!isOpen) setPassword('')
  }, [isOpen])

  if (!isOpen) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim() || verifying) return
    onConfirm(password)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container modal-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-content">
            <h2>🔒 تأیید امنیتی</h2>
            <p>برای این عملیات، رمز عبور ادمین رو وارد کن</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={verifying}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="stepup-password">رمز عبور ادمین</label>
              <input
                id="stepup-password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={verifying}
                autoFocus
                placeholder="رمز عبور"
              />
            </div>

            {error && (
              <div className="admin-error" style={{ marginTop: 12 }}>
                ❌ {error}
              </div>
            )}

            <p
              style={{
                marginTop: 12,
                fontSize: 12,
                color: '#766f64',
                lineHeight: 1.7,
              }}
            >
              بعد از تأیید، تا ۱۵ دقیقه می‌تونی عملیات حساس انجام بدی.
            </p>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={verifying}
            >
              انصراف
            </button>
            <button
              type="submit"
              className="btn primary-btn"
              disabled={verifying || !password.trim()}
            >
              {verifying ? '...' : '🔓 تأیید'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}