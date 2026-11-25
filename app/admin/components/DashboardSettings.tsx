'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// 🎯 پچ ۷۲ — مودال «تنظیم داشبورد»: هر کاربر تیک می‌زند کدام بخش‌های آماری
//   در داشبوردش باشند؛ انتخابش برای حساب خودش ذخیره می‌شود (dashboard_prefs).
//   ترتیب فهرست = ترتیب اولویت تب‌ها. هر بخش = یک تب مستقل در داشبورد.
// 🎯 پچ ۷۴ — کنترل کامل چیدمان:
//   ① جابه‌جایی با کشیدن‌ورها کردن (drag & drop) ردیف‌های روشن + دکمه‌های
//      ▲▼ برای موبایل (لمس HTML5-drag ندارد)
//   ② حالت قفل 🔒 — با سوییچ، همان لحظه ذخیره می‌شود؛ وقتی قفل است تیک و
//      جابه‌جایی غیرفعال است و روی داشبورد هم دکمهٔ ✕ بخش‌ها نمی‌آید
//   ③ ذخیرهٔ ویجت‌ها و قفل در همان PUT — سرور مقدار ارسال‌نشده را حفظ
//      می‌کند، پس قفل‌کردن هیچ‌وقت چیدمان را پاک نمی‌کند
type WidgetDef = { id: string; label: string; icon: string; description: string }

export default function DashboardSettings({
  widgets,
  initialWidgets,
  initialLocked = false,
}: {
  widgets: WidgetDef[]
  initialWidgets: string[]
  initialLocked?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locking, setLocking] = useState(false)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<string[]>(initialWidgets)
  const [locked, setLocked] = useState(initialLocked)
  const dragFrom = useRef<number | null>(null)

  const openModal = () => {
    setOpen(true)
    setErr('')
    setLoading(true)
    // تازه‌سازی از سرور — اگر از دستگاه دیگری تنظیم کرده باشد همین‌جا می‌آید
    fetch('/api/admin/dashboard/prefs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.widgets)) setSelected(d.widgets as string[])
        if (typeof d?.locked === 'boolean') setLocked(d.locked)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const toggle = (id: string) => {
    setSelected((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    )
  }

  // جابه‌جایی داخل فهرست روشن‌ها (پایهٔ ▲▼ و drag)
  const move = (from: number, to: number) => {
    setSelected((p) => {
      if (from < 0 || to < 0 || from >= p.length || to >= p.length || from === to)
        return p
      const next = [...p]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const onDragStart = (i: number) => {
    dragFrom.current = i
  }
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    const from = dragFrom.current
    if (from === null || from === i) return
    move(from, i)
    dragFrom.current = i
  }
  const onDragEnd = () => {
    dragFrom.current = null
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

  // 🔒 قفل/بازکردن — همان لحظه ذخیره و اعمال می‌شود
  const toggleLock = async () => {
    if (locking) return
    const next = !locked
    if (next && selected.length === 0) {
      setErr('اول حداقل یک بخش تیک بزن، بعد قفل کن.')
      return
    }
    setLocking(true)
    setErr('')
    try {
      const r = await fetch('/api/admin/dashboard/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: next }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        setErr(String(d?.error || 'قفل ذخیره نشد — دوباره تلاش کن'))
        setLocking(false)
        return
      }
      setLocked(next)
      setLocking(false)
      router.refresh()
    } catch {
      setErr('قفل ذخیره نشد — دوباره تلاش کن')
      setLocking(false)
    }
  }

  // 🎯 پچ ۷۴-الف — ردیف‌های روشن باید به «ترتیب انتخاب کاربر» رندر شوند، نه
  // ترتیب رجیستری: قبلاً با widgets.filter می‌گرفتیم؛ در نتیجه ▲▼ و درگ روی
  // اندیس‌های selected عمل می‌کردند ولی نمایش ثابت می‌ماند (به‌ظاهر کار
  // نمی‌کردند). با map روی selected، اندیس‌های نمایش = اندیس‌های ذخیره.
  const enabledRows = selected
    .map((id) => widgets.find((w) => w.id === id))
    .filter((w): w is WidgetDef => Boolean(w))
  const disabledRows = widgets.filter((w) => !selected.includes(w.id))

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
              تیک بزن کدام بخش‌ها در داشبوردت باشند و با کشیدن یا ▲▼ ترتیب‌شان
              را عوض کن — هر بخش یک تب مستقل می‌شود. این انتخاب{' '}
              <strong>فقط برای حساب خودت</strong> ذخیره می‌شود و با هر دستگاهی
              که وارد شوی همین چیدمان را می‌بینی.
            </p>

            {/* 🔒 قفل چیدمان — همان لحظه ذخیره می‌شود */}
            <div className={`dash-lock-row${locked ? ' locked' : ''}`}>
              <button
                type="button"
                className="dash-lock-switch"
                onClick={toggleLock}
                disabled={locking || loading}
                aria-pressed={locked}
                title={locked ? 'بازکردن چیدمان' : 'قفل کردن چیدمان'}
              >
                {locking ? '…' : locked ? '🔒 قفل است' : '🔓 باز است'}
              </button>
              <span className="dash-lock-text">
                <strong>قفل چیدمان</strong>
                <small>
                  {locked
                    ? 'چیدمان قفل است — تیک، جابه‌جایی و ✕ بخش‌ها غیرفعال‌اند.'
                    : 'با قفل کردن، بخش‌ها از روی داشبورد قابل حذف یا جابه‌جایی نیستند.'}
                </small>
              </span>
            </div>

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
                {/* بخش‌های روشن — به ترتیب تب‌ها، قابل کشیدن */}
                {enabledRows.map((w, i) => (
                  <div
                    key={w.id}
                    className={`dash-widget-row checked${
                      locked ? '' : ' draggable'
                    }`}
                    draggable={!locked}
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    onDrop={(e) => {
                      e.preventDefault()
                      onDragEnd()
                    }}
                  >
                    {!locked && <span className="dash-widget-grip" title="بکش و رها کن">⠿</span>}
                    <input
                      type="checkbox"
                      checked
                      disabled={locked}
                      onChange={() => toggle(w.id)}
                    />
                    <span className="dash-widget-icon">{w.icon}</span>
                    <span className="dash-widget-text">
                      <strong>{w.label}</strong>
                      <small>{w.description}</small>
                    </span>
                    <span className="dash-widget-order">تب {i + 1}</span>
                    {!locked && (
                      <span className="dash-widget-movers">
                        <button
                          type="button"
                          className="dash-move-btn"
                          onClick={() => move(i, i - 1)}
                          disabled={i === 0}
                          title="یک پله بالاتر"
                          aria-label={`${w.label}: یک پله بالاتر`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="dash-move-btn"
                          onClick={() => move(i, i + 1)}
                          disabled={i === enabledRows.length - 1}
                          title="یک پله پایین‌تر"
                          aria-label={`${w.label}: یک پله پایین‌تر`}
                        >
                          ▼
                        </button>
                      </span>
                    )}
                  </div>
                ))}

                {/* بخش‌های خاموش */}
                {disabledRows.length > 0 && enabledRows.length > 0 && (
                  <p className="dash-modal-group">خاموش — با تیک فعال می‌شوند:</p>
                )}
                {disabledRows.map((w) => (
                  <label
                    key={w.id}
                    className={`dash-widget-row${
                      locked ? ' locked-row' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={locked}
                      onChange={() => toggle(w.id)}
                    />
                    <span className="dash-widget-icon">{w.icon}</span>
                    <span className="dash-widget-text">
                      <strong>{w.label}</strong>
                      <small>{w.description}</small>
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
                disabled={saving || loading || locked}
              >
                {locked
                  ? '🔒 برای تغییر، اول قفل را باز کن'
                  : saving
                    ? 'در حال ذخیره…'
                    : 'ذخیره چیدمان'}
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
