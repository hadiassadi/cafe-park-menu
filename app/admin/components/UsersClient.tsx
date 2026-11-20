'use client'

import { useState, useTransition } from 'react'
import {
  createStaffMember,
  deleteStaffMember,
  setOperatorRole,
  toggleStaffMember,
  updateStaffMember,
} from '@/app/admin/users/actions'
import AdminModal from './AdminModal'

// 🎯 پچ ۵۵ — فاز ۴-الف: «🔐 کاربران و دسترسی»
// بخش ۱ — کارکنان کافه: CRUD کامل روی staff_members (نقش، موبایل، یادداشت)
// بخش ۲ — کاربران پنل: نقش هر کاربر پنل (مالک/مدیر/صندوق‌دار/کارمند) + پنجرهٔ شیفت
// اعمال نقش‌ها روی منو و گاردها در پچ ۵۶ (فاز ۴-ب) وصل می‌شود

export type StaffRow = {
  id: number
  full_name: string
  role: string
  phone: string | null
  is_active: boolean
  note: string | null
  created_at: string
}

export type PanelUser = {
  user_id: string
  email: string
  display_name: string
  role: string
  has_profile: boolean
  shift_start: string | null
  shift_end: string | null
  last_sign_in: string | null
  is_me: boolean
}

const STAFF_ROLE_LABEL: Record<string, string> = {
  owner: 'مالک',
  manager: 'مدیر',
  cashier: 'صندوق‌دار',
  waiter: 'گارسون',
  kitchen: 'آشپزخانه',
  staff: 'کارمند',
}

const OP_ROLE_LABEL: Record<string, string> = {
  owner: 'مالک',
  manager: 'مدیر',
  cashier: 'صندوق‌دار',
  staff: 'کارمند',
}

const OP_ROLE_COLOR: Record<string, { bg: string; fg: string }> = {
  owner: { bg: '#e8f3ec', fg: '#2d5d3e' },
  manager: { bg: '#e8f0f8', fg: '#4a7fa5' },
  cashier: { bg: '#fff4d9', fg: '#9a6b3f' },
  staff: { bg: '#f1ebdf', fg: '#766f64' },
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

const cellTh: React.CSSProperties = {
  padding: '6px 8px',
  fontWeight: 800,
  fontSize: 11.5,
  color: '#766f64',
  textAlign: 'right',
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR')
}

function roleBadge(role: string, labels: Record<string, string>, colors: Record<string, { bg: string; fg: string }>) {
  const c = colors[role] ?? { bg: '#f1ebdf', fg: '#766f64' }
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        borderRadius: 999,
        padding: '2px 9px',
        background: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {labels[role] ?? role}
    </span>
  )
}

// ── فرم مشترک کارمند (ایجاد/ویرایش) داخل مودال ──
function StaffForm({
  initial,
  onDone,
}: {
  initial: StaffRow | null
  onDone: () => void
}) {
  const [err, setErr] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    startTransition(async () => {
      const res = initial
        ? await updateStaffMember(fd)
        : await createStaffMember(fd)
      if (res?.error) setErr(res.error)
      else onDone()
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
          نام کامل *
        </label>
        <input
          name="full_name"
          defaultValue={initial?.full_name ?? ''}
          placeholder="مثلاً سارا محمدی"
          style={{ ...inputStyle, width: '100%' }}
          required
        />
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
          نقش شغلی
        </label>
        <select name="role" defaultValue={initial?.role ?? 'staff'} style={{ ...inputStyle, width: '100%' }}>
          {Object.entries(STAFF_ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
          موبایل (اختیاری — برای فاز بعدی: ورود شیفت)
        </label>
        <input
          name="phone"
          defaultValue={initial?.phone ?? ''}
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          dir="ltr"
          style={{ ...inputStyle, width: '100%', textAlign: 'left' }}
        />
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
          یادداشت (اختیاری)
        </label>
        <textarea
          name="note"
          defaultValue={initial?.note ?? ''}
          rows={2}
          placeholder="مثلاً مسئول صندوق شب‌ها"
          style={{ ...inputStyle, width: '100%', resize: 'vertical', font: 'inherit' }}
        />
      </div>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {err && (
        <p style={{ fontSize: 12.5, color: '#9b3c32', fontWeight: 700 }}>
          ⚠️ {err}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn"
        style={{
          fontSize: 12.5,
          background: '#2d5d3e',
          color: '#fff',
          borderColor: '#2d5d3e',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? '⏳ در حال ثبت…' : initial ? '💾 ذخیرهٔ تغییرات' : '➕ ثبت کارمند'}
      </button>
    </form>
  )
}

export default function UsersClient({
  staff,
  panelUsers,
}: {
  staff: StaffRow[]
  panelUsers: PanelUser[]
}) {
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; row: StaffRow | null } | null>(
    null
  )

  const activeCount = staff.filter((s) => s.is_active).length
  const byRole: Record<string, number> = {}
  for (const s of staff) if (s.is_active) byRole[s.role] = (byRole[s.role] ?? 0) + 1

  return (
    <div>
      <h1 className="admin-page-title" style={{ marginBottom: 6 }}>
        🔐 کاربران و دسترسی
      </h1>
      <p className="admin-page-sub" style={{ marginBottom: 14 }}>
        بخش اول فهرست کارکنان کافه است (منابع انسانی)؛ بخش دوم کاربرانی است که به
        پنل وارد می‌شوند و نقش هرکدام سطح دسترسی‌اش را تعیین می‌کند — اعمال نقش‌ها
        روی منو و گاردها در پچ بعدی فعال می‌شود.
      </p>

      {/* ── بخش ۱: کارکنان کافه ── */}
      <section className="admin-card" style={{ marginBottom: 14, padding: 12 }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#766f64' }}>
            👷 کارکنان کافه ({fa(activeCount)} فعال از {fa(staff.length)})
          </div>
          {Object.entries(byRole).map(([r, n]) => (
            <span
              key={r}
              style={{
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 999,
                padding: '2px 9px',
                background: '#f8f5ef',
                color: '#766f64',
              }}
            >
              {STAFF_ROLE_LABEL[r] ?? r}: {fa(n)}
            </span>
          ))}
          <button
            onClick={() => setModal({ mode: 'new', row: null })}
            className="btn"
            style={{
              fontSize: 12.5,
              background: '#2d5d3e',
              color: '#fff',
              borderColor: '#2d5d3e',
              marginInlineStart: 'auto',
            }}
          >
            ➕ کارمند جدید
          </button>
        </div>

        {staff.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: '6px 2px',
              borderBottom: '1px dashed #eee7db',
              opacity: s.is_active ? 1 : 0.55,
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 13 }}>{s.full_name}</span>
            {roleBadge(s.role, STAFF_ROLE_LABEL, OP_ROLE_COLOR)}
            {s.phone && (
              <span dir="ltr" style={{ fontSize: 12, color: '#8a8378' }}>
                {s.phone}
              </span>
            )}
            {s.note && (
              <span style={{ fontSize: 11.5, color: '#8a8378', fontStyle: 'italic' }}>
                {s.note}
              </span>
            )}
            {!s.is_active && (
              <span style={{ fontSize: 11, color: '#9b3c32', fontWeight: 700 }}>
                غیرفعال
              </span>
            )}
            <div style={{ display: 'flex', gap: 6, marginInlineStart: 'auto' }}>
              <button
                onClick={() => setModal({ mode: 'edit', row: s })}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#4a7fa5',
                  font: 'inherit',
                }}
              >
                ✏️ ویرایش
              </button>
              <form
                action={async (fd) => {
                  await toggleStaffMember(fd)
                }}
              >
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  title={s.is_active ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: s.is_active ? '#9b3c32' : '#2d5d3e',
                    font: 'inherit',
                  }}
                >
                  {s.is_active ? '✕ غیرفعال' : '✓ فعال'}
                </button>
              </form>
              <form
                action={async (fd) => {
                  await deleteStaffMember(fd)
                }}
                onSubmit={(e) => {
                  if (!window.confirm(`«${s.full_name}» کامل حذف شود؟`))
                    e.preventDefault()
                }}
              >
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  title="حذف کامل"
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#9b3c32',
                    font: 'inherit',
                  }}
                >
                  🗑
                </button>
              </form>
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <p className="empty-admin">
            هنوز کارمندی ثبت نشده — با «➕ کارمند جدید» شروع کن.
          </p>
        )}
      </section>

      {/* ── بخش ۲: کاربران پنل ── */}
      <section className="admin-card" style={{ padding: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#766f64', marginBottom: 4 }}>
          🖥 کاربران پنل ({fa(panelUsers.length)}) — نقش تعیین‌کنندهٔ دسترسی است
        </div>
        <p style={{ fontSize: 11.5, color: '#8a8378', marginBottom: 10 }}>
          مالک: همهٔ بخش‌ها + تایید خودکار بستن شیفت · مدیر و صندوق‌دار: محدودتر
          (اعمال در پچ بعدی). پنجرهٔ شیفت از صفحهٔ «شیفت‌ها» تنظیم می‌شود.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 640,
              fontSize: 12.5,
            }}
          >
            <thead>
              <tr style={{ background: '#f4efe6' }}>
                <th style={cellTh}>ایمیل</th>
                <th style={cellTh}>نام نمایشی</th>
                <th style={cellTh}>نقش</th>
                <th style={cellTh}>پنجرهٔ شیفت</th>
                <th style={cellTh}>آخرین ورود</th>
              </tr>
            </thead>
            <tbody>
              {panelUsers.map((u) => (
                <tr key={u.user_id} style={{ borderTop: '1px solid #f1ebdf' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <span dir="ltr" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {u.email}
                    </span>
                    {u.is_me && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#2d5d3e',
                          background: '#e8f3ec',
                          borderRadius: 999,
                          padding: '1px 7px',
                          marginInlineStart: 6,
                        }}
                      >
                        (شما)
                      </span>
                    )}
                    {!u.has_profile && (
                      <span
                        style={{
                          fontSize: 10.5,
                          color: '#9a6b3f',
                          background: '#fff4d9',
                          borderRadius: 999,
                          padding: '1px 7px',
                          marginInlineStart: 6,
                        }}
                      >
                        بدون پروفایل
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                    {u.display_name}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <form
                      action={async (fd) => {
                        await setOperatorRole(fd)
                      }}
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <input type="hidden" name="user_id" value={u.user_id} />
                      <input type="hidden" name="email" value={u.email} />
                      <select name="role" defaultValue={u.role} style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }}>
                        {Object.entries(OP_ROLE_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn" style={{ fontSize: 11.5 }}>
                        💾
                      </button>
                    </form>
                  </td>
                  <td style={{ padding: '6px 8px', color: '#8a8378', fontSize: 11.5 }}>
                    {u.shift_start && u.shift_end
                      ? `${u.shift_start.slice(0, 5)} تا ${u.shift_end.slice(0, 5)}`
                      : 'تنظیم نشده'}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#8a8378', fontSize: 11.5 }}>
                    {u.last_sign_in
                      ? new Date(u.last_sign_in).toLocaleString('fa-IR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* مودال مشترک کارمند */}
      {modal && (
        <AdminModal
          title={modal.mode === 'new' ? '👤 کارمند جدید' : '✏️ ویرایش کارمند'}
          onClose={() => setModal(null)}
        >
          <StaffForm initial={modal.row} onDone={() => setModal(null)} />
        </AdminModal>
      )}
    </div>
  )
}
