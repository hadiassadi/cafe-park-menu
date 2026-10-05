'use client'

import { useMemo, useState } from 'react'
import {
  activateTheme,
  addTheme,
  updateTheme,
} from './actions'
import Modal from '../components/Modal'
import FontUpload from '../components/FontUpload'

type FontFile = {
  url: string
  name: string
  size?: number
  family?: string
  weight?: number
}

type Theme = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  primary_color: string
  secondary_color: string
  background_color: string
  surface_color: string
  text_color: string
  muted_text_color: string
  accent_color: string
  font_family: string | null
  font_url: string | null
  font_regular_url: string | null
  font_medium_url: string | null
  font_semibold_url: string | null
  font_bold_url: string | null
  font_extrabold_url: string | null
  font_black_url: string | null
  font_metadata: FontFile[] | null
  border_radius: number
}

const COLOR_FIELDS = [
  ['primary_color', 'رنگ اصلی'],
  ['secondary_color', 'رنگ ثانویه'],
  ['background_color', 'پس‌زمینه'],
  ['surface_color', 'سطح کارت‌ها'],
  ['text_color', 'رنگ متن'],
  ['muted_text_color', 'متن کم‌رنگ'],
  ['accent_color', 'رنگ تأکیدی'],
] as const

export default function ThemesManager({
  themes,
}: {
  themes: Theme[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // فرم state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formColors, setFormColors] = useState<Record<string, string>>({})
  const [formBorderRadius, setFormBorderRadius] = useState('10')
  const [formFonts, setFormFonts] = useState<FontFile[]>([])
  const [formFontFamily, setFormFontFamily] = useState('')

  // خانواده‌های موجود
  const availableFamilies = useMemo(() => {
    const families = new Set<string>()
    for (const font of formFonts) {
      if (font.family) families.add(font.family)
    }
    return Array.from(families).sort()
  }, [formFonts])

  // @font-face برای پیش‌نمایش
  const previewFontFaces = useMemo(() => {
  const faces: string[] = []

  for (const font of formFonts) {
    if (!font.url || !font.family) continue

    faces.push(`
      @font-face {
        font-family: "${font.family}";
        src: url("${font.url}") format("${getFormatFromUrl(font.url)}");
        font-weight: ${font.weight ?? 400};
        font-style: normal;
        font-display: swap;
      }
    `)
  }

  return faces.join('\n')
}, [formFonts])

  function openAddModal() {
    setEditingTheme(null)
    setFormName('')
    setFormDescription('')
    setFormColors({
      primary_color: '#6b4f3a',
      secondary_color: '#f3eee7',
      background_color: '#fffdf9',
      surface_color: '#ffffff',
      text_color: '#29251f',
      muted_text_color: '#766f64',
      accent_color: '#9a6b3f',
    })
    setFormBorderRadius('10')
    setFormFonts([])
    setFormFontFamily('')
    setMessage(null)
    setError(null)
    setIsModalOpen(true)
  }

  function openEditModal(theme: Theme) {
    setEditingTheme(theme)
    setFormName(theme.name)
    setFormDescription(theme.description ?? '')
    setFormColors({
      primary_color: theme.primary_color,
      secondary_color: theme.secondary_color,
      background_color: theme.background_color,
      surface_color: theme.surface_color,
      text_color: theme.text_color,
      muted_text_color: theme.muted_text_color,
      accent_color: theme.accent_color,
    })
    setFormBorderRadius(String(theme.border_radius))
    setFormFonts(
      Array.isArray(theme.font_metadata) ? theme.font_metadata : []
    )
    setFormFontFamily(theme.font_family ?? '')
    setMessage(null)
    setError(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingTheme(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const formData = new FormData()

      if (editingTheme) {
        formData.append('id', editingTheme.id)
      }

      formData.append('name', formName)
      formData.append('description', formDescription)

      for (const [key] of COLOR_FIELDS) {
        formData.append(key, formColors[key] ?? '#000000')
      }

      formData.append('border_radius', formBorderRadius)
      formData.append('font_family', formFontFamily)
      formData.append(
        'current_font_metadata',
        JSON.stringify(formFonts)
      )

      // پیدا کردن URL فونت‌ها بر اساس وزن
      const findFontByWeight = (weight: number) => {
        const font = formFonts.find(
          (f) =>
            f.family &&
            f.weight === weight &&
            f.family.trim() === formFontFamily.trim()
        )
        return font?.url ?? ''
      }

      formData.append('font_regular_url', findFontByWeight(400))
      formData.append('font_medium_url', findFontByWeight(500))
      formData.append('font_semibold_url', findFontByWeight(600))
      formData.append('font_bold_url', findFontByWeight(700))
      formData.append('font_extrabold_url', findFontByWeight(800))
      formData.append('font_black_url', findFontByWeight(900))

      const result = editingTheme
        ? await updateTheme(formData)
        : await addTheme(formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      setMessage('✅ ذخیره شد')
      await new Promise((r) => setTimeout(r, 800))
      window.location.reload()
    } catch {
      setError('❌ خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate() {
    if (!editingTheme) return

    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.append('id', editingTheme.id)

    const result = await activateTheme(formData)

    if (result?.error) {
      setError(result.error)
      return
    }

    setMessage('✅ فعال شد')
    await new Promise((r) => setTimeout(r, 600))
    window.location.reload()
  }

  return (
    <div className="themes-manager">
      <div className="themes-page-header">
        <div>
          <h1>مدیریت قالب‌ها</h1>
          <p>ظاهر منوی عمومی را از اینجا مدیریت کن.</p>
        </div>

        <button
          type="button"
          className="btn primary-btn"
          onClick={openAddModal}
        >
          + قالب جدید
        </button>
      </div>

      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}

      <div className="themes-layout">
        <aside className="themes-list-panel">
          <div className="themes-list-header">
            <span>قالب‌ها</span>
            <span>وضعیت</span>
          </div>

          <div className="themes-list-scroll">
            {themes.map((theme) => (
              <button
                type="button"
                key={theme.id}
                className={
                  'theme-list-row' +
                  (editingTheme?.id === theme.id ? ' selected' : '')
                }
                onClick={() => openEditModal(theme)}
              >
                <span className="theme-list-main">
                  <span
                    className="theme-color-preview"
                    style={{ background: theme.primary_color }}
                  />
                  <span>
                    <strong>{theme.name}</strong>
                    <small>{theme.description || 'بدون توضیح'}</small>
                  </span>
                </span>

                <span
                  className={
                    'theme-status' + (theme.is_active ? ' active' : '')
                  }
                >
                  {theme.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="theme-detail-empty">
          <h2>قالبی انتخاب نشده</h2>
          <p>از لیست راست یه قالب انتخاب کن یا «قالب جدید» بزن.</p>
        </section>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTheme ? 'ویرایش قالب' : 'قالب جدید'}
        subtitle={editingTheme ? editingTheme.name : 'یه قالب جدید بساز'}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={closeModal}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="theme-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving
                ? '...'
                : editingTheme
                  ? 'ذخیره تغییرات'
                  : 'ایجاد قالب'}
            </button>
          </>
        }
      >
        {/* ✅ فونت‌های پیش‌نمایش */}
        {previewFontFaces && (
          <style
            dangerouslySetInnerHTML={{ __html: previewFontFaces }}
          />
        )}

        <form id="theme-form" onSubmit={handleSubmit}>
          {editingTheme && !editingTheme.is_active && (
            <div className="theme-activate-box">
              <div>
                <strong>این قالب فعال نیست</strong>
                <p>برای استفاده توی منو، فعالش کن</p>
              </div>
              <button
                type="button"
                className="btn primary-btn"
                onClick={handleActivate}
              >
                فعال کردن
              </button>
            </div>
          )}

          {editingTheme?.is_active && (
            <div className="theme-active-banner">
              ✅ این قالب فعال است
            </div>
          )}

          <div className="theme-form-grid">
            <div className="field">
              <label>نام قالب *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثلاً کلاسیک"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label>توضیحات</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="توضیح کوتاه"
              />
            </div>
          </div>

          <div className="theme-section-title">🎨 رنگ‌ها</div>

          <div className="theme-form-grid">
            {COLOR_FIELDS.map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <div className="color-field">
                  <input
                    type="color"
                    value={formColors[key] ?? '#000000'}
                    onChange={(e) =>
                      setFormColors({
                        ...formColors,
                        [key]: e.target.value,
                      })
                    }
                  />
                  <span>{formColors[key]}</span>
                </div>
              </div>
            ))}

            <div className="field">
              <label>گردی گوشه‌ها</label>
              <input
                type="number"
                value={formBorderRadius}
                onChange={(e) => setFormBorderRadius(e.target.value)}
                min="0"
                max="40"
              />
            </div>
          </div>

          <div className="theme-section-title">📝 فونت‌ها</div>

          <FontUpload
            value={formFonts}
            onChange={setFormFonts}
            previewFamily={formFontFamily || undefined}
          />

          {availableFamilies.length > 0 && (
            <div className="field" style={{ marginTop: 16 }}>
              <label>خانواده فونت (توی منو استفاده بشه)</label>
              <select
                value={formFontFamily}
                onChange={(e) => setFormFontFamily(e.target.value)}
              >
                <option value="">انتخاب فونت</option>
                {availableFamilies.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
              <small className="theme-font-help">
                این فونت توی منوی عمومی اعمال می‌شه
              </small>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}

function getFormatFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase() || ''
  if (ext === 'woff2') return 'woff2'
  if (ext === 'woff') return 'woff'
  if (ext === 'otf') return 'opentype'
  if (ext === 'ttf') return 'truetype'
  return 'truetype'
}