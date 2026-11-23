'use client'

import { useState, useTransition } from 'react'
import { setStaffAuthLink } from './actions'

// 🎯 پچ ۶۵ — انتخاب اکانت پنل متصل به کارمند، با نمایش خطا زیر خود فرم
// (الگوی RoleForm صفحهٔ کاربران: شکستِ اکشن نباید بی‌صدا از نظر پنهان بماند)

export type LinkOption = {
  user_id: string
  email: string
  display_name: string
  role_label: string
}

const inputStyle: React.CSSProperties = {
  fontSize: 12.5,
  padding: '6px 9px',
  borderRadius: 8,
  border: '1px solid #d8d0c4',
  font: 'inherit',
  color: '#4b443b',
  background: '#fff',
}

export default function StaffAuthLinkForm({
  staffId,
  current,
  options,
}: {
  staffId: number
  current: string | null
  options: LinkOption[]
}) {
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    setSaved(false)
    startTransition(async () => {
      const res = await setStaffAuthLink(fd)
      if (res?.error) setErr(res.error)
      else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        setTimeout(() => window.location.reload(), 600)
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      <form
        onSubmit={submit}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <input type="hidden" name="staff_id" value={staffId} />
        <select
          name="auth_user_id"
          defaultValue={current ?? 'none'}
          style={{ ...inputStyle, maxWidth: 320 }}
        >
          <option value="none">— بدون اکانت پنل —</option>
          {options.map((o) => (
            <option key={o.user_id} value={o.user_id}>
              {o.email} — {o.display_name} ({o.role_label})
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="btn"
          style={{ fontSize: 12, opacity: pending ? 0.6 : 1 }}
        >
          {pending ? '⏳' : '🔗 ذخیرهٔ اتصال'}
        </button>
        {saved && !err && (
          <span style={{ fontSize: 11, color: '#2d5d3e', fontWeight: 700 }}>
            ✓ ذخیره شد
          </span>
        )}
      </form>
      {err && (
        <span style={{ fontSize: 11.5, color: '#9b3c32', fontWeight: 700 }}>
          ⚠️ {err}
        </span>
      )}
      <p style={{ fontSize: 11, color: '#8a8378', margin: 0 }}>
        اتصال اشتباه یعنی شیفت‌های پیامکیِ این کارمند به حساب نفر دیگری ثبت
        می‌شود — هر اکانت فقط به یک کارمند وصل می‌شود و باید پروفایل اپراتوری
        داشته باشد.
      </p>
    </div>
  )
}
