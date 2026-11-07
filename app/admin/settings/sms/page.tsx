'use client'

import { useState, useTransition } from 'react'
import { getSmsSettings, saveSmsSettings, sendTestSms, type SmsSettings } from './actions'
import { useEffect } from 'react'

export default function SmsSettingsPage() {
  const [settings, setSettings] = useState<SmsSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [sender, setSender] = useState('')
  const [template, setTemplate] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const res = await getSmsSettings()
      if (res.error) {
        setMsg({ kind: 'err', text: res.error })
        return
      }
      if (res.data) {
        setSettings(res.data)
        setTemplate(res.data.sms_otp_template || 'cafe-park-otp')
        setSender(res.data.sms_sender || '')
        // کلید ذخیره‌شده را نشان نمی‌دهیم؛ فقط اگر چیزی تایپ شود جایگزین می‌شود
      }
    })
  }, [])

  const hasKey = !!settings?.sms_api_key

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setSaving(true)
    startTransition(async () => {
      const patch: Record<string, string> = { sms_sender: sender, sms_otp_template: template }
      if (apiKey.trim()) patch.sms_api_key = apiKey.trim()
      const res = await saveSmsSettings(patch)
      setSaving(false)
      if (res.error) return setMsg({ kind: 'err', text: res.error })
      setApiKey('')
      setSettings((prev) => ({
        ...(prev ?? { sms_api_key: null, sms_sender: null, sms_otp_template: null }),
        ...patch,
        sms_api_key: 'saved',
      }))
      setMsg({ kind: 'ok', text: 'تنظیمات ذخیره شد ✓' })
    })
  }

  function handleTest(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setTesting(true)
    startTransition(async () => {
      const res = await sendTestSms(testPhone)
      setTesting(false)
      if (res.error) return setMsg({ kind: 'err', text: res.error })
      setMsg({ kind: 'ok', text: `پیامک آزمایشی به ${testPhone} رفت؛ کد 123456 با قالب «${template}» ارسال شد ✓` })
    })
  }

  const busy = pending || saving || testing

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>📱 تنظیمات پیامک (کاوه‌نگار)</h1>
      <p style={{ opacity: 0.7, fontSize: 13, lineHeight: 2 }}>
        کلید API را از پنل کاوه‌نگار (تنظیمات → API Key) بگیرید و برای ارسال کد ورود،
        در بخش «قالب‌های تأییدشده» یک قالب با متغیر <code>%token</code> بسازید و نامش را اینجا وارد کنید.
      </p>

      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            margin: '12px 0',
            background: msg.kind === 'ok' ? '#e6f6ea' : '#fdeaea',
            color: msg.kind === 'ok' ? '#176a32' : '#8f2020',
            fontSize: 14,
          }}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <label style={{ fontSize: 13 }}>
          کلید API کاوه‌نگار
          <input
            type="password"
            dir="ltr"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? '•••••••• (ذخیره شده — برای تغییر پر کنید)' : 'کلید را اینجا وارد کنید'}
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          شماره خط (اختیاری — خالی یعنی خط پیش‌فرض کاوه‌نگار)
          <input
            dir="ltr"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="مثلاً 10008663"
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          نام قالب OTP تأییدشده
          <input
            dir="ltr"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '11px 16px',
            borderRadius: 8,
            border: 'none',
            background: busy ? '#999' : '#6f4e37',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
        </button>
      </form>

      <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid #e5e0da' }} />

      <form onSubmit={handleTest} style={{ display: 'grid', gap: 12 }}>
        <strong style={{ fontSize: 14 }}>پیامک آزمایشی</strong>
        <label style={{ fontSize: 13 }}>
          شماره‌ی خودت (گیرنده‌ی پیامک آزمایشی)
          <input
            dir="ltr"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="09xxxxxxxxx"
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !testPhone}
          style={{
            padding: '11px 16px',
            borderRadius: 8,
            border: 'none',
            background: busy || !testPhone ? '#999' : '#2e7d32',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: busy || !testPhone ? 'default' : 'pointer',
          }}
        >
          {testing ? 'در حال ارسال…' : 'ارسال پیامک آزمایشی'}
        </button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          پیامک آزمایشی از همان قالب OTP استفاده می‌کند؛ اگر برسد یعنی کلید، خط و قالب همگی درست‌اند.
        </span>
      </form>
    </div>
  )
}
