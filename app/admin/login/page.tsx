'use client'

import { useState } from 'react'
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

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(faError(error.message))
      setLoading(false)
      return
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
