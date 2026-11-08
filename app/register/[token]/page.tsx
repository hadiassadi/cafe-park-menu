'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const REASONS: Record<string, string> = {
  not_found: 'این لینک پیدا نشد؛ از مدیر کافه لینک جدید بگیر.',
  used: 'این لینک قبلاً استفاده شده است.',
  expired: 'مهلت این لینک تمام شده است؛ از مدیر لینک جدید بگیر.',
  revoked: 'این لینک توسط مدیر باطل شده است.',
  invalid: 'لینک نامعتبر است.',
}

const toEnDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

export default function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null)
  const [inviteState, setInviteState] = useState<'checking' | 'valid' | 'invalid'>('checking')
  const [invalidReason, setInvalidReason] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    params.then((p) => {
      const t = p.token ?? ''
      setToken(t)
      fetch(`/api/register/invite?token=${encodeURIComponent(t)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (d?.valid) setInviteState('valid')
          else {
            setInviteState('invalid')
            setInvalidReason(REASONS[d?.reason] ?? REASONS.invalid)
          }
        })
        .catch(() => {
          setInviteState('invalid')
          setInvalidReason('خطا در بررسی لینک؛ دوباره تلاش کن.')
        })
    })
  }, [params])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fullName, phone: toEnDigits(phone) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'ثبت‌نام ناموفق بود')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px', direction: 'rtl', fontFamily: 'inherit' }}>
      <h1 style={{ textAlign: 'center', fontSize: 20, color: '#29251f' }}>☕ تکمیل ثبت‌نام کافه پارک</h1>

      {inviteState === 'checking' && (
        <div style={{ textAlign: 'center', marginTop: 32, color: '#766f64' }}>⏳ در حال بررسی لینک...</div>
      )}

      {inviteState === 'invalid' && (
        <div style={{ background: '#fdecea', border: '1px solid #f5c6c0', borderRadius: 14, padding: 18, marginTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 30 }}>🔒</div>
          <strong style={{ display: 'block', marginTop: 8, color: '#9b3c32' }}>{invalidReason}</strong>
          <Link href="/" style={{ display: 'inline-block', marginTop: 14, color: '#6b4f3a', fontSize: 13 }}>
            ← بازگشت به منو
          </Link>
        </div>
      )}

      {inviteState === 'valid' && done && (
        <div style={{ background: '#e9f3ec', border: '1px solid #b9dcc4', borderRadius: 14, padding: 24, marginTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>✅</div>
          <strong style={{ display: 'block', marginTop: 8, fontSize: 15, color: '#2d5d3e' }}>
            ثبت‌نامت کامل شد و حساب‌ت تأیید شد!
          </strong>
          <small style={{ display: 'block', marginTop: 6, color: '#4a6b55', fontSize: 12, lineHeight: 1.9 }}>
            کیف پول این دستگاه فعال شد. برای شارژ و فعال‌سازی کامل با مدیر کافه هماهنگ کن.
          </small>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <Link href="/my-orders" style={{ background: '#2d5d3e', color: '#fff', borderRadius: 10, padding: '9px 16px', fontSize: 13, textDecoration: 'none' }}>
              پنل مشتری
            </Link>
            <Link href="/" style={{ background: '#fff', color: '#6b4f3a', border: '1px solid #e3ddd2', borderRadius: 10, padding: '9px 16px', fontSize: 13, textDecoration: 'none' }}>
              منو
            </Link>
          </div>
        </div>
      )}

      {inviteState === 'valid' && !done && (
        <form
          onSubmit={submit}
          style={{ background: '#fff', border: '1px solid #e3ddd2', borderRadius: 14, padding: 20, marginTop: 24 }}
        >
          <p style={{ fontSize: 13, color: '#766f64', lineHeight: 2, margin: '0 0 14px' }}>
            این لینک اختصاصیِ مدیر کافه است؛ با تکمیل این فرم، حساب‌ت تأیید می‌شود
            و کیف پولِ همین دستگاه وصل می‌شود.
          </p>

          <label style={{ display: 'block', fontSize: 12, color: '#766f64', marginBottom: 6 }}>نام و نام خانوادگی</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="مثلاً سارا محمدی"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #e3ddd2', fontSize: 14, marginBottom: 12 }}
          />

          <label style={{ display: 'block', fontSize: 12, color: '#766f64', marginBottom: 6 }}>شماره موبایل</label>
          <input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xxxxxxxxx"
            inputMode="numeric"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #e3ddd2', fontSize: 14, textAlign: 'left' }}
          />

          {error && <div style={{ color: '#9b3c32', fontSize: 12, marginTop: 10 }}>{error}</div>}

          <button
            type="submit"
            disabled={busy || fullName.trim().length < 3 || phone.trim().length < 10}
            style={{
              width: '100%',
              marginTop: 14,
              padding: '11px 0',
              borderRadius: 10,
              border: 'none',
              background: '#2d5d3e',
              color: '#fff',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy || fullName.trim().length < 3 || phone.trim().length < 10 ? 0.6 : 1,
            }}
          >
            {busy ? '⏳ در حال ثبت...' : 'تکمیل ثبت‌نام و تأیید'}
          </button>
        </form>
      )}
    </div>
  )
}
