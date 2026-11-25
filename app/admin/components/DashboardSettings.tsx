'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 🎯 پچ ۷۲ — مودال «تنظیم داشبورد»: هر کاربر تیک می‌زند کدام بخش‌های آماری
//   در داشبوردش باشند؛ انتخابش برای حساب خودش ذخیره می‌شود (dashboard_prefs).
//   ترتیب فهرست = ترتیب اولویت تب‌ها. هر بخش = یک تب مستقل در داشبورد.
type WidgetDef = { id: string; label: string; icon: string; description: string }

export default function DashboardSettings({
  widgets,
  initialWidgets,
}: {
  widgets: WidgetDef[]
  initialWidgets: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<string[]>(initialWidgets)

  const openModal = () => {
    setOpen(true)
    setErr('')
    setLoading(true)
    // تازه‌سازی از سرور — اگر از دستگاه دیگری تنظیم کرده باشد همین‌جا می‌آید
    fetch('/api/admin/dashboard/prefs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.widgets)) setSelected(d.widgets as string[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const toggle = (id: string) => {
    setSelected((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    )
  }

  const save = async () => {
    setSaving(true)
    setErr('')
    try {
      const r = await fetch('/api/admin/dashboard/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: selected }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        setErr(String(d?.error || 'ذخیره نشد — دوباره تلاش کن'))
        setSaving(false)
        return
      }
      setSaving(false)
      setOpen(false)
      router.refresh()
    } catch {
      setErr('ذخیره نشد — دوباره تلاش کن')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="dash-settings-btn"
        onClick={openModal}
        title="تنظیم داشبورد"
      >
        ⚙️ تنظیم داشبورد
      </button>

      {open && (
        <div
          className="dash-modal-overlay"
          onClick={() => !saving && setOpen(false)}
          aria-hidden="true"
        >
          <div
            className="dash-modal"
            role="dialog"
            aria-label="تنظیم داشبورد"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dash-modal-header">
              <h3>⚙️ تنظیم داشبورد</h3>
              <button
                type="button"
                className="dash-modal-close"
                onClick={() => !saving && setOpen(false)}
                aria-label="بستن"
              >
                ✕
              </button>
            </div>
            <p className="dash-modal-hint">
              تیک بزن کدام بخش‌ها در داشبوردت باشند — هر بخش یک تب مستقل می‌شود.
              این انتخاب <strong>فقط برای حساب خودت</strong> ذخیره می‌شود و
              با هر دستگاهی که وارد شوی همین چیدمان را می‌بینی.
            </p>

            {loading ? (
              <div className="dash-modal-body" aria-busy="true">
                <div className="skel-card" />
                <div className="skel-card" />
              </div>
            ) : widgets.length === 0 ? (
              <div className="dash-modal-body">
                <p className="dash-modal-empty">
                  بخش قابل‌انتخابی برای نقش تو وجود ندارد.
                </p>
              </div>
            ) : (
              <div className="dash-modal-body">
                {widgets.map((w) => (
                  <label
                    key={w.id}
                    className={`dash-widget-row${
                      selected.includes(w.id) ? ' checked' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(w.id)}
                      onChange={() => toggle(w.id)}
                    />
                    <span className="dash-widget-icon">{w.icon}</span>
                    <span className="dash-widget-text">
                      <strong>{w.label}</strong>
                      <small>{w.description}</small>
                    </span>
                    <span className="dash-widget-order">
                      {selected.includes(w.id)
                        ? `تب ${selected.indexOf(w.id) + 1}`
                        : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {err && <p className="dash-modal-error">{err}</p>}

            <div className="dash-modal-footer">
              <button
                type="button"
                className="dash-modal-save"
                onClick={save}
                disabled={saving || loading}
              >
                {saving ? 'در حال ذخیره…' : 'ذخیره چیدمان'}
              </button>
              <button
                type="button"
                className="dash-modal-cancel"
                onClick={() => !saving && setOpen(false)}
                disabled={saving}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
