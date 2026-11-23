'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'

// 🎯 پچ ۶۴ — فرم ورود موبایل کارمند: شمارهٔ ثبت‌شده در پرسنل → کد پیامکی →
// توکن شیفت (کوکی ۱۲ ساعته). فقط کارمندانی که اکانت پنل متصل دارند وارد می‌شوند.

const card: CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  border: '1px solid #e5ddd0',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  borderRadius: 10,
  border: '1px solid #d8d0c4',
  padding: '10px 12px',
  fontSize: 16,
  fontFamily: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
}

const btn: CSSProperties = {
  width: '100%',
  minHeight: 50,
  borderRadius: 12,
  border: 'none',
  background: '#2d5d3e',
  color: '#fff',
  fontSize: 16,
  fontWeight: 800,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

export default function StaffOtpForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'phone' | 'code'>('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const sendCode = async () => {
    setError('')
    setInfo('')
    const digits = phone.replace(/\D/g, '')
    if (!/^09\d{9}$/.test(digits)) {
      setError('شمارهٔ موبایل را با ارقام انگلیسی مثل 09123456789 وارد کنید')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/auth/staff-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        setError(d?.error ?? 'ارسال کد ناموفق بود')
        return
      }
      setStage('code')
      setInfo('کد پیامک شد — تا ۱۰ دقیقه اعتبار دارد')
    } catch {
      setError('ارتباط با سرور برقرار نشد')
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async () => {
    setError('')
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) {
      setError('کد ۶ رقمی را کامل وارد کنید')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/auth/staff-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ''),
          code: digits,
        }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        setError(d?.error ?? 'کد تأیید نشد')
        return
      }
      // رفرش صفحهٔ سرور — حالا با کوکی شیفت، کارت شیفت رندر می‌شود
      router.refresh()
    } catch {
      setError('ارتباط با سرور برقرار نشد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
        ورود کارمند
      </div>
      <p style={{ fontSize: 12.5, color: '#766f64', margin: '0 0 14px' }}>
        فقط شماره‌ای که در بخش پرسنل ثبت شده و به اکانت پنل متصل است کد می‌گیرد.
      </p>

      {stage === 'phone' ? (
        <>
          <input
            style={inputStyle}
            dir="ltr"
            inputMode="tel"
            placeholder="09123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            style={{ ...btn, marginTop: 12, opacity: busy ? 0.6 : 1 }}
            onClick={sendCode}
            disabled={busy}
          >
            {busy ? 'در حال ارسال…' : '📨 دریافت کد'}
          </button>
        </>
      ) : (
        <>
          <input
            style={{ ...inputStyle, textAlign: 'center', letterSpacing: 6, fontSize: 20 }}
            dir="ltr"
            inputMode="numeric"
            maxLength={6}
            placeholder='· · · · · ·'
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            disabled={busy}
          />
          <button
            type="button"
            style={{ ...btn, marginTop: 12, opacity: busy ? 0.6 : 1 }}
            onClick={verifyCode}
            disabled={busy}
          >
            {busy ? 'در حال بررسی…' : '✓ ورود'}
          </button>
          <button
            type="button"
            style={{
              ...btn,
              marginTop: 8,
              background: 'transparent',
              color: '#4a7fa5',
              border: '1px solid #c8d7e0',
              minHeight: 42,
              fontSize: 14,
            }}
            onClick={() => {
              setStage('phone')
              setCode('')
              setInfo('')
              setError('')
            }}
            disabled={busy}
          >
            اصلاح شماره / ارسال دوباره
          </button>
        </>
      )}

      {info && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: '#2d5d3e',
            background: '#eef5f0',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          {info}
        </div>
      )}
      {error && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: '#9b3c32',
            background: '#fbeeeb',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
