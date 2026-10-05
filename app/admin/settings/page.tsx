'use client'

import { useEffect, useState } from 'react'
import Modal from '../components/Modal'

type Settings = {
  cafe_name: string
  tagline: string
  hero_title: string
  hero_subtitle: string
  footer_text: string
  address: string
  phone: string
  instagram: string
  working_hours: string
}

type SectionKey = 'basic' | 'header' | 'contact'

const EMPTY: Settings = {
  cafe_name: '',
  tagline: '',
  hero_title: '',
  hero_subtitle: '',
  footer_text: '',
  address: '',
  phone: '',
  instagram: '',
  working_hours: '',
}

function normalize(data: Record<string, unknown> | null): Settings {
  const result = { ...EMPTY }
  if (!data) return result
  for (const key of Object.keys(EMPTY) as (keyof Settings)[]) {
    const val = data[key]
    result[key] = typeof val === 'string' ? val : ''
  }
  return result
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Modal state
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null)
  const [draft, setDraft] = useState<Settings>(EMPTY)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        const normalized = normalize(data)
        setForm(normalized)
        setDraft(normalized)
      })
      .catch(() => {
        setForm(EMPTY)
        setDraft(EMPTY)
      })
      .finally(() => setLoading(false))
  }, [])

  function openSection(key: SectionKey) {
    setDraft(form)
    setActiveSection(key)
    setMessage(null)
  }

  function closeSection() {
    setActiveSection(null)
    setMessage(null)
  }

  const handleDraftChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setDraft({ ...draft, [e.target.name]: e.target.value })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('API error:', err)
        throw new Error(err.error || 'خطا در ذخیره')
      }

      setForm(draft)
      setMessage('✅ تنظیمات ذخیره شد')
      setTimeout(() => {
        closeSection()
      }, 1000)
    } catch (err) {
      setMessage('❌ ذخیره نشد، دوباره تلاش کن')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="admin">در حال بارگذاری...</div>
  }

  // کارت‌های بخش‌ها
  const sections: Array<{
    key: SectionKey
    icon: string
    title: string
    desc: string
    preview: string
  }> = [
    {
      key: 'basic',
      icon: '☕',
      title: 'اطلاعات اصلی',
      desc: 'نام و شعار کافه',
      preview: form.cafe_name || 'تنظیم نشده',
    },
    {
      key: 'header',
      icon: '🎨',
      title: 'متن‌های هدر و فوتر',
      desc: 'عنوان و زیرعنوان جایگزین',
      preview: form.hero_title || form.tagline || 'پیش‌فرض',
    },
    {
      key: 'contact',
      icon: '📞',
      title: 'اطلاعات تماس',
      desc: 'آدرس، تلفن، اینستاگرام',
      preview: form.address || form.phone || 'تنظیم نشده',
    },
  ]

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>تنظیمات کافه</h1>
        <p className="admin-subtitle">
          روی هر بخش کلیک کن تا ویرایشش کنی
        </p>
      </div>

      {message && <div className="admin-message">{message}</div>}

      {/* کارت‌های بخش‌ها */}
      <div className="settings-cards">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            className="settings-card"
            onClick={() => openSection(section.key)}
          >
            <span className="settings-card-icon">{section.icon}</span>

            <div className="settings-card-content">
              <strong>{section.title}</strong>
              <small>{section.preview}</small>
            </div>

            <span className="settings-card-arrow">‹</span>
          </button>
        ))}
      </div>

      {/* Modal بخش اصلی */}
      <Modal
        isOpen={activeSection === 'basic'}
        onClose={closeSection}
        title="اطلاعات اصلی"
        subtitle="نام و شعار کافه"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={closeSection}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="settings-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving ? '...' : 'ذخیره'}
            </button>
          </>
        }
      >
        <form id="settings-form" onSubmit={handleSave}>
          <div className="field field-wide">
            <label>نام کافه</label>
            <input
              name="cafe_name"
              value={draft.cafe_name}
              onChange={handleDraftChange}
              placeholder="کافه پارک"
              autoFocus
            />
          </div>

          <div className="field field-wide">
            <label>شعار / زیرنویس هدر</label>
            <textarea
              name="tagline"
              value={draft.tagline}
              onChange={handleDraftChange}
              placeholder="پارک سلامت شیراز · قهوه، نوشیدنی و غذا"
              rows={2}
            />
          </div>
        </form>
      </Modal>

      {/* Modal هدر و فوتر */}
      <Modal
        isOpen={activeSection === 'header'}
        onClose={closeSection}
        title="متن‌های هدر و فوتر"
        subtitle="اگه خالی باشن، از نام کافه و شعار استفاده می‌شه"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={closeSection}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="settings-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving ? '...' : 'ذخیره'}
            </button>
          </>
        }
      >
        <form id="settings-form" onSubmit={handleSave}>
          <div className="field field-wide">
            <label>عنوان جایگزین هدر (اختیاری)</label>
            <input
              name="hero_title"
              value={draft.hero_title}
              onChange={handleDraftChange}
              placeholder="اگه خالی باشه، نام کافه استفاده می‌شه"
            />
          </div>

          <div className="field field-wide">
            <label>زیرعنوان جایگزین هدر (اختیاری)</label>
            <input
              name="hero_subtitle"
              value={draft.hero_subtitle}
              onChange={handleDraftChange}
              placeholder="اگه خالی باشه، شعار استفاده می‌شه"
            />
          </div>

          <div className="field field-wide">
            <label>متن فوتر</label>
            <input
              name="footer_text"
              value={draft.footer_text}
              onChange={handleDraftChange}
              placeholder="کافه پارک · پارک سلامت شیراز"
            />
          </div>
        </form>
      </Modal>

      {/* Modal تماس */}
      <Modal
        isOpen={activeSection === 'contact'}
        onClose={closeSection}
        title="اطلاعات تماس"
        subtitle="این اطلاعات توی هدر منو نمایش داده می‌شه"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={closeSection}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="settings-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving ? '...' : 'ذخیره'}
            </button>
          </>
        }
      >
        <form id="settings-form" onSubmit={handleSave}>
          <div className="field field-wide">
            <label>آدرس</label>
            <input
              name="address"
              value={draft.address}
              onChange={handleDraftChange}
              placeholder="شیراز، پارک سلامت"
            />
          </div>

          <div className="field field-wide">
            <label>شماره تماس</label>
            <input
              name="phone"
              value={draft.phone}
              onChange={handleDraftChange}
              placeholder="071-xxxxxxxx"
              dir="ltr"
            />
          </div>

          <div className="field field-wide">
            <label>اینستاگرام</label>
            <input
              name="instagram"
              value={draft.instagram}
              onChange={handleDraftChange}
              placeholder="@cafepark"
              dir="ltr"
            />
          </div>

          <div className="field field-wide">
            <label>ساعت کاری</label>
            <input
              name="working_hours"
              value={draft.working_hours}
              onChange={handleDraftChange}
              placeholder="هر روز ۹ صبح تا ۱۲ شب"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}