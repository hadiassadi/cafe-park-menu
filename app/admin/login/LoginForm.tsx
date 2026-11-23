'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

function faError(message: string) {
  if (/invalid login credentials/i.test(message)) {
    return 'ایمیل یا رمز عبور اشتباه است.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'ایمیل شما هنوز تأیید نشده است.'
  }
  return 'ورود انجام نشد. دوباره تلاش کن.'
}

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // 🎯 پچ ۶۵: اگر همین مرورگر از قبل نشستِ باز دارد، همان اول لو بده —
  // «با کدام حساب وارد شده‌ای» قبل از تایپ، نه بعد از گم‌شدن در پنل
  const [staleSession, setStaleSession] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/api/auth/session-whoami', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d?.authed && d?.email) setStaleSession(String(d.email))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 🎯 پچ ۶۵: قبل از ورود، هر نشست قبلی همین مرورگر پاک می‌شود — حتی
    // کوکی‌های httpOnly که با auth.signOut مرورگری پاک نمی‌شوند. بدون این،
    // ورودِ کاربر جدید می‌توانست روی نشست قدیمیِ کاربر دیگر سوار شود.
    try {
      await fetch('/api/auth/session-reset', { method: 'POST' })
    } catch {
      // اگر endpoint موقتاً در دسترس نبود، ورود عادی ادامه پیدا می‌کند
    }
    await supabaseBrowser().auth.signOut()

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(faError(error.message))
      setLoading(false)
      return
    }

    // 🎯 پچ ۶۵: اثبات هویت — نشستِ واقعی سرور باید همان ایمیلی باشد که تایپ شد.
    // اگر کوکی قدیمی جا مانده بود، پاک می‌شود و کاربر یک‌بار دیگر ورود می‌زند.
    try {
      const v = await fetch('/api/auth/session-whoami', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      if (v?.authed && v?.email && v.email.toLowerCase() !== email.trim().toLowerCase()) {
        await fetch('/api/auth/session-reset', { method: 'POST' }).catch(() => {})
        await supabaseBrowser().auth.signOut()
        setError(
          'نشست قدیمی این مرورگر مزاحم ورود بود و پاک شد — ایمیل و رمز را دوباره بزن.'
        )
        setStaleSession('')
        setLoading(false)
        return
      }
    } catch {
      // بررسی هویت شکست خورد — مثل قبل ادامه بده
    }

    // 🎯 پچ ۵۹-آ: بعد از ورود موفق، وضعیت دسترسی پنل را دقیق چک می‌کنیم تا
    // دیگر کاربرِ بدون نقش «بی‌صدا» به همین صفحه برگردد — دلیل واقعی را می‌بیند
    try {
      const res = await fetch('/api/admin/session-check', { cache: 'no-store' })
      const data = await res.json()
      if (data?.authed && data?.hasProfile) {
        router.push('/admin')
        router.refresh()
        return
      }
      if (data?.reason === 'no-profile') {
        await supabaseBrowser().auth.signOut()
        setError(
          'رمز درست است ولی این حساب هنوز دسترسی پنل ندارد — نقشش را از صفحهٔ «کاربران و دسترسی» ثبت کن (تیک «نمایش همهٔ کاربران») و دوباره وارد شو.'
        )
        setLoading(false)
        return
      }
    } catch {
      // endpoint در دسترس نبود — مثل قبل ادامه بده
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-head">
          <div className="login-logo" aria-hidden="true">
            ☕
          </div>
          <h1>ورود مدیریت</h1>
          <p>پنل مدیریت منوی کافه پارک</p>
        </div>

        {staleSession && (
          <p
            role="status"
            style={{
              fontSize: 12.5,
              color: '#8a6d1f',
              background: '#fdf6e3',
              border: '1px solid #ecd9a0',
              borderRadius: 8,
              padding: '8px 10px',
              margin: '0 0 12px',
            }}
          >
            ⚠️ این مرورگر از قبل با <b dir="ltr">{staleSession}</b> وارد شده است.
            با زدن «ورود» آن نشست پاک و جایگزین می‌شود.
          </p>
        )}

        <div className="login-field">
          <label htmlFor="login-email">ایمیل</label>
          <input
            id="login-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="login-field">
          <label htmlFor="login-password">رمز عبور</label>
          <input
            id="login-password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <button className="login-btn" type="submit" disabled={loading}>
          {loading ? 'در حال ورود…' : 'ورود'}
        </button>
      </form>
    </main>
  )
}
