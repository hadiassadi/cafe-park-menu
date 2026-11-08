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

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e3ddd2',
  borderRadius: 14,
  padding: 20,
  marginTop: 24,
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#766f64',
  marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e3ddd2',
  fontSize: 14,
  fontFamily: 'inherit',
  background: '#fffdf9',
  color: '#29251f',
}

export default function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null)
  const [inviteState, setInviteState] = useState<'checking' | 'valid' | 'invalid'>('checking')
  const [invalidReason, setInvalidReason] = useState<string | null>(null)

  // فرم ثبت‌نام یکپارچه — هم‌سو با فرم باشگاه مشتریان پنل
  const [orgId, setOrgId] = useState('general')
  const [fullName, setFullName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [phone, setPhone] = useState('')
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([])
  const [rules, setRules] = useState<{ general: string; org: string }>({ general: '', org: '' })
  const [acceptRules, setAcceptRules] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [orgMembership, setOrgMembership] = useState<'activated' | 'pending_review' | null>(null)

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
      // لیست سازمان‌ها و قوانین — همان منابع فرم باشگاه پنل مشتری
      fetch('/api/membership/organizations', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d?.organizations)) setOrganizations(d.organizations) })
        .catch(() => {})
      fetch('/api/membership/rules', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setRules({ general: d?.general || '', org: d?.org || '' }))
        .catch(() => {})
    })
  }, [params])

  const isOrg = orgId !== 'general'
  const formValid =
    fullName.trim().length >= 3 &&
    phone.trim().length >= 10 &&
    acceptRules &&
    (!isOrg || memberId.trim().length > 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fullName,
          phone: toEnDigits(phone),
          orgId,
          memberId: isOrg ? toEnDigits(memberId).trim() : null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'ثبت‌نام ناموفق بود')
      setOrgMembership(data?.orgMembership ?? null)
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 16px', direction: 'rtl', fontFamily: 'inherit' }}>
      <h1 style={{ textAlign: 'center', fontSize: 20, color: '#29251f' }}>☕ ثبت‌نام کافه پارک</h1>

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
          {orgMembership === 'activated' && (
            <small style={{ display: 'block', marginTop: 6, color: '#4a6b55', fontSize: 12, lineHeight: 1.9 }}>
              🎓 عضویت سازمانی‌ات هم فعال شد؛ تخفیف‌های سازمانی به‌صورت خودکار در سفارش‌هایت اعمال می‌شود.
            </small>
          )}
          {orgMembership === 'pending_review' && (
            <small style={{ display: 'block', marginTop: 6, color: '#8a5a24', fontSize: 12, lineHeight: 1.9 }}>
              ⏳ اطلاعاتت در لیست سازمان پیدا نشد؛ درخواست عضویت سازمانی‌ات برای بررسی دستی ثبت شد و حساب اصلی‌ات تأیید است.
            </small>
          )}
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
        <form onSubmit={submit} style={cardStyle}>
          <p style={{ fontSize: 13, color: '#766f64', lineHeight: 2, margin: '0 0 14px' }}>
            این لینک اختصاصیِ مدیر کافه است؛ با تکمیل این فرم حساب‌ت تأیید می‌شود،
            کیف پولِ همین دستگاه وصل می‌شود و نوع مشتری‌ات (عادی یا سازمانی) را همین‌جا انتخاب می‌کنی.
          </p>

          <label style={labelStyle}>نوع عضویت / سازمان *</label>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={{ ...inputStyle, marginBottom: 12, cursor: 'pointer' }}>
            <option value="general">👤 باشگاه مشتریان کافه پارک (عادی)</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>🎓 {org.name}</option>
            ))}
          </select>

          <label style={labelStyle}>نام و نام خانوادگی *</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="مثلاً سارا محمدی"
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          {isOrg && (
            <>
              <label style={labelStyle}>شماره دانشجویی / پرسنلی *</label>
              <input
                dir="ltr"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="4021..."
                style={{ ...inputStyle, marginBottom: 12, textAlign: 'left' }}
              />
            </>
          )}

          <label style={labelStyle}>شماره موبایل *</label>
          <input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xxxxxxxxx"
            inputMode="numeric"
            style={{ ...inputStyle, textAlign: 'left' }}
          />

          <div style={{ background: '#fbf9f5', border: '1px dashed #d8d0c4', borderRadius: 8, padding: 12, fontSize: 12, color: '#766f64', lineHeight: 1.8, marginTop: 14 }}>
            <strong style={{ color: '#6b4f3a', display: 'block', marginBottom: 6 }}>📜 شرایط استفاده:</strong>
            <div style={{ whiteSpace: 'pre-line' }}>{isOrg ? rules.org || 'در حال بارگذاری...' : rules.general || 'در حال بارگذاری...'}</div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #d8d0c4', color: '#9b3c32', fontSize: 11 }}>
              ⚠️ پذیرفتن این قوانین به منزله اجرای همیشگی آن‌ها نیست. کافه پارک حق تغییر این شرایط را بر اساس شرایط اقتصادی برای خود محفوظ می‌دارد.
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginTop: 12, color: '#29251f' }}>
            <input type="checkbox" checked={acceptRules} onChange={(e) => setAcceptRules(e.target.checked)} />
            <span>شرایط فوق را خوانده‌ام و اطلاعات وارد شده مربوط به خودم است.</span>
          </label>

          {error && <div style={{ color: '#9b3c32', fontSize: 12, marginTop: 10 }}>{error}</div>}

          <button
            type="submit"
            disabled={busy || !formValid}
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
              cursor: busy || !formValid ? 'default' : 'pointer',
              opacity: busy || !formValid ? 0.6 : 1,
            }}
          >
            {busy ? '⏳ در حال ثبت...' : 'تکمیل ثبت‌نام و تأیید'}
          </button>
        </form>
      )}
    </div>
  )
}
