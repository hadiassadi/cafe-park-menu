'use client'

import { useEffect, useMemo, useState } from 'react'
import { OP_ROLES, OpRole, ROLE_LABEL } from '@/lib/admin/role-matrix'
import { defaultPathsForRole, type AdminModuleDef } from '@/lib/admin/modules'

type Operator = {
  user_id: string
  email: string
  display_name: string
  role: OpRole
  is_active: boolean
  allowed_paths: string[]
  default_paths: string[]
}

// 🎯 پچ ۶۰ — مدیر برای هر کاربر تیک می‌زن کدام ماژول‌ها در منویش باشد.
//   «پیش‌فرض نقش» = لیست خالی در دیتابیس (ماتریس پچ ۵۶ حاکم است)
//   «دلخواه» = فقط ماژول‌های تیک‌شده — منو و گیت سرور هر دو همین را اعمال می‌کنند
// 🎯 پچ ۶۳ — همهٔ تیک‌ها آزاد شدند: داشبورد هم مثل بقیه تیک‌خور است و تیک‌های
//   مالک هم قابل ذخیره‌اند (مالکِ لیست‌خالی = همه‌چیز؛ مالکِ لیست‌دار = محدود).
//   ویرایشِ ردیفِ خودِ کاربرِ واردشده، وقتی تیکِ «کاربران و دسترسی» برداشته
//   می‌شود، تأیید دومرحله‌ای می‌خواهد تا ادمین خودش را قفل نکند.

const CSS = `
.am60-wrap{max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.am60-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.am60-title{font-size:1.15rem;font-weight:800}
.am60-sub{font-size:.85rem;opacity:.7;max-width:520px}
.am60-flash{background:rgba(34,197,94,.12);color:#16a34a;border:1px solid rgba(34,197,94,.4);border-radius:10px;padding:8px 12px;font-size:.85rem}
.am60-error{background:rgba(239,68,68,.1);color:#dc2626;border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:8px 12px;font-size:.85rem}
.am60-card{background:rgba(127,127,127,.06);border:1px solid rgba(127,127,127,.25);border-radius:14px;overflow:hidden}
.am60-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;cursor:pointer;flex-wrap:wrap}
.am60-row:hover{background:rgba(127,127,127,.08)}
.am60-id{display:flex;flex-direction:column;gap:2px;min-width:180px}
.am60-name{font-weight:700}
.am60-mail{direction:ltr;font-size:.8rem;opacity:.7;text-align:left;word-break:break-all}
.am60-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.am60-chip{font-size:.72rem;border-radius:999px;padding:3px 10px;border:1px solid rgba(127,127,127,.4)}
.am60-chip--custom{background:rgba(59,130,246,.15);border-color:rgba(59,130,246,.5);color:#3b82f6}
.am60-chip--role{background:rgba(127,127,127,.12)}
.am60-chip--off{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.4);color:#dc2626}
.am60-role{font-size:.78rem;border:1px solid rgba(127,127,127,.4);border-radius:8px;padding:4px 8px;background:rgba(127,127,127,.1);color:inherit;cursor:pointer;font-family:inherit}
.am60-body{border-top:1px solid rgba(127,127,127,.25);padding:12px 14px;display:flex;flex-direction:column;gap:14px}
.am60-group-label{font-size:.8rem;font-weight:800;opacity:.65;margin-bottom:6px}
.am60-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.am60-check{display:flex;align-items:center;gap:8px;font-size:.88rem;background:rgba(127,127,127,.06);border:1px solid rgba(127,127,127,.2);border-radius:10px;padding:8px 10px;cursor:pointer;user-select:none}
.am60-check input{accent-color:#3b82f6;width:16px;height:16px}
.am60-check--locked{opacity:.55;cursor:not-allowed}
.am60-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.am60-btn{border:none;border-radius:10px;padding:8px 14px;font-size:.85rem;font-weight:700;cursor:pointer;background:#3b82f6;color:#fff}
.am60-btn--ghost{background:transparent;color:inherit;border:1px solid rgba(127,127,127,.4)}
.am60-btn:disabled{opacity:.5;cursor:wait}
.am60-note{font-size:.78rem;opacity:.65}
.am60-loading{opacity:.7;font-size:.9rem}
@media (max-width:640px){.am60-grid{grid-template-columns:1fr 1fr}}
`

export default function AccessManager() {
  const [ops, setOps] = useState<Operator[]>([])
  const [modules, setModules] = useState<AdminModuleDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [openId, setOpenId] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string[]>>({})
  const [savingId, setSavingId] = useState('')
  // 🎯 پچ ۶۰-ج: نقش خودِ کاربرِ واردشده — تغییر نقش دیگران فقط با مالک
  const [myRole, setMyRole] = useState<OpRole | null>(null)
  // 🎯 پچ ۶۳: ایمیل خودِ کاربرِ واردشده — برای تشخیص «ردیفِ خودم»
  const [myEmail, setMyEmail] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/api/admin/access', { cache: 'no-store' })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error('بارگذاری انجام نشد'))
      )
      .then((d) => {
        if (!mounted) return
        const operators: Operator[] = d.operators || []
        setOps(operators)
        setModules(d.modules || [])
        const init: Record<string, string[]> = {}
        for (const op of operators) {
          // اگر لیست دلخواه دارد همان، وگرنه پیش‌فرض نقش برای نمایش تیک‌ها
          init[op.user_id] =
            op.allowed_paths.length > 0
              ? [...op.allowed_paths]
              : defaultPathsForRole(op.role)
        }
        setDrafts(init)
      })
      .catch((e: Error) => mounted && setError(e.message || 'بارگذاری انجام نشد'))
      .finally(() => mounted && setLoading(false))
    fetch('/api/admin/whoami', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!mounted) return
        if (d?.role) setMyRole(d.role as OpRole)
        // 🎯 پچ ۶۳: برای هشدار «خودت را قفل نکن»
        if (d?.email) setMyEmail(String(d.email))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, AdminModuleDef[]>()
    for (const m of modules) {
      const arr = map.get(m.group) || []
      arr.push(m)
      map.set(m.group, arr)
    }
    return Array.from(map.entries())
  }, [modules])

  // 🎯 پچ ۶۳: همهٔ تیک‌ها آزاد — داشبورد هم مثل بقیه انتخاب‌شدنی است
  function toggle(userId: string, href: string) {
    setDrafts((prev) => {
      const cur = prev[userId] || []
      const next = cur.includes(href)
        ? cur.filter((x) => x !== href)
        : [...cur, href]
      return { ...prev, [userId]: next }
    })
  }

  function resetToRole(userId: string) {
    const op = ops.find((o) => o.user_id === userId)
    // 🎯 پچ ۶۰-ج: پیش‌فرض بر اساس نقشِ فعلیِ کارت (نه مقدار قدیمی GET)
    setDrafts((prev) => ({
      ...prev,
      [userId]: op ? defaultPathsForRole(op.role) : [],
    }))
  }

  // 🎯 پچ ۶۰-ج: تغییر نقش در همین صفحه — تیک‌ها به پیش‌فرض نقش جدید برمی‌گردند
  function changeRole(userId: string, role: OpRole) {
    setOps((prev) =>
      prev.map((o) => (o.user_id === userId ? { ...o, role } : o))
    )
    setDrafts((prev) => ({ ...prev, [userId]: defaultPathsForRole(role) }))
  }

  const isMe = (op: Operator) =>
    !!op.email &&
    !!myEmail &&
    op.email.trim().toLowerCase() === myEmail.trim().toLowerCase()

  async function save(userId: string) {
    const op = ops.find((o) => o.user_id === userId)
    const draft = drafts[userId] || []
    // 🎯 پچ ۶۳: حفاظت از خودقفل‌شدگی — اگر ردیفِ خودم است و تیکِ
    // «کاربران و دسترسی» را برداشته‌ام، با تأیید صریح ادامه بده
    if (op && isMe(op) && !draft.includes('/admin/users')) {
      const ok = window.confirm(
        'هشدار: برای خودت تیکِ «کاربران و دسترسی» را برداشته‌ای — پس از ذخیره، دیگر به این صفحه دسترسی نداری تا با SQL برگردد. ادامه می‌دهی؟'
      )
      if (!ok) return
    }
    setSavingId(userId)
    setError('')
    try {
      const r = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          allowedPaths: draft,
          role: op?.role,
        }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'ذخیره انجام نشد')
      const saved: string[] = d.allowed_paths || []
      setOps((prev) =>
        prev.map((o) =>
          o.user_id === userId
            ? {
                ...o,
                allowed_paths: saved,
                role: (d.role as OpRole) || o.role,
              }
            : o
        )
      )
      setFlash('✓ ذخیره شد — منو و گیت سرور همین لحظه همین را اعمال می‌کنند')
      setTimeout(() => setFlash(''), 3000)
    } catch (e) {
      setError((e as Error).message || 'ذخیره انجام نشد')
    } finally {
      setSavingId('')
    }
  }

  return (
    <div className="am60-wrap">
      <style>{CSS}</style>
      <div className="am60-head">
        <div>
          <div className="am60-title">🧩 سطح دسترسی ماژول‌ها</div>
          <div className="am60-sub">
            برای هر کاربر تیک بزن کدام بخش‌ها در منویش باشد — منو و گیت سرور هر
            دو همین لیست را اعمال می‌کنند. داشبورد هم مثل بقیهٔ تیک‌هاست؛ اگر
            همهٔ تیک‌ها را برداری، کاربر به پیش‌فرض نقشش برمی‌گردد.
          </div>
        </div>
        {flash && <div className="am60-flash">{flash}</div>}
        {error && <div className="am60-error">{error}</div>}
      </div>

      {loading && <div className="am60-loading">در حال بارگذاری…</div>}

      {ops.map((op) => {
        const custom = op.allowed_paths.length > 0
        const draft = drafts[op.user_id] || []
        const open = openId === op.user_id
        const canEditRole = myRole === 'owner'
        return (
          <div key={op.user_id} className="am60-card">
            <div
              className="am60-row"
              onClick={() => setOpenId(open ? '' : op.user_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setOpenId(open ? '' : op.user_id)
              }}
            >
              <div className="am60-id">
                <span className="am60-name">
                  {op.display_name || op.email || op.user_id.slice(0, 8)}
                  {isMe(op) && ' — شما'}
                </span>
                {op.email && <span className="am60-mail">{op.email}</span>}
              </div>
              <div className="am60-chips">
                {/* 🎯 پچ ۶۰-ج: نقش هم در همین صفحه قابل تغییر است — فقط با مالک */}
                <select
                  className="am60-role"
                  value={op.role}
                  disabled={!canEditRole}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    changeRole(op.user_id, e.target.value as OpRole)
                  }
                >
                  {OP_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                {op.role === 'owner' && (
                  <span className="am60-chip am60-chip--role">
                    مالک — تا وقتی لیست ذخیره نشده همه‌چیز باز است
                  </span>
                )}
                {custom ? (
                  <span className="am60-chip am60-chip--custom">
                    دلخواه ({op.allowed_paths.length} ماژول)
                  </span>
                ) : (
                  <span className="am60-chip am60-chip--role">پیش‌فرض نقش</span>
                )}
                {!op.is_active && (
                  <span className="am60-chip am60-chip--off">غیرفعال</span>
                )}
                <span>{open ? '▾' : '▸'}</span>
              </div>
            </div>

            {open && (
              <div
                className="am60-body"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {groups.map(([group, items]) => (
                  <div key={group}>
                    <div className="am60-group-label">{group}</div>
                    <div className="am60-grid">
                      {items.map((m) => (
                        <label key={m.href} className="am60-check">
                          <input
                            type="checkbox"
                            checked={draft.includes(m.href)}
                            onChange={() => toggle(op.user_id, m.href)}
                          />
                          <span>
                            {m.icon} {m.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="am60-actions">
                  <button
                    type="button"
                    className="am60-btn"
                    disabled={savingId === op.user_id}
                    onClick={() => save(op.user_id)}
                  >
                    {savingId === op.user_id ? 'در حال ذخیره…' : '💾 ذخیره'}
                  </button>
                  <button
                    type="button"
                    className="am60-btn am60-btn--ghost"
                    disabled={savingId === op.user_id}
                    onClick={() => resetToRole(op.user_id)}
                  >
                    بازگشت به پیش‌فرض نقش
                  </button>
                  <span className="am60-note">
                    لیست خالی = پیش‌فرض نقش. برای ردیفِ خودت حواس‌ت به تیکِ
                    «کاربران و دسترسی» باشد تا قفل نشوی.
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
