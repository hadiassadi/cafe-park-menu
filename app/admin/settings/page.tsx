'use client'

import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { revalidateMenu } from '../actions'
import { supabaseBrowser } from '@/lib/supabase/client'

/* ============================================================
   انواع و مقدارهای پیش‌فرض
   ============================================================ */

type TextKey =
  | 'cafe_name'
  | 'tagline'
  | 'logo_url'
  | 'hero_title'
  | 'hero_subtitle'
  | 'footer_text'
  | 'address'
  | 'phone'
  | 'instagram'
  | 'working_hours'
  | 'maps_url'
  | 'og_title'
  | 'og_description'
  | 'og_image_url'
  | 'hero_bg_image_url'
  | 'bg_image_url'

type BoolKey =
  | 'og_enabled'
  | 'show_address'
  | 'show_phone'
  | 'show_instagram'
  | 'show_working_hours'
  | 'show_quote'
  | 'show_share_button'
  | 'show_featured_filter'
  | 'show_product_images'
  | 'show_product_size'
  | 'show_footer'
  | 'bg_enabled'
  | 'floating_enabled'
  | 'address_in_header'
  | 'address_in_footer'
  | 'address_in_floating'
  | 'phone_in_header'
  | 'phone_in_footer'
  | 'phone_in_floating'
  | 'instagram_in_header'
  | 'instagram_in_footer'
  | 'instagram_in_floating'
  | 'hours_in_header'
  | 'hours_in_footer'

type Settings = Record<TextKey, string> &
  Record<BoolKey, boolean> & {
    hero_bg_mode: 'color' | 'image'
    contact_header_style: 'icons' | 'text'
    floating_side: 'left' | 'right'
    hero_overlay: number
    bg_overlay: number
    bg_gallery: string[]
  }

type SectionKey =
  | 'basic'
  | 'header'
  | 'appearance'
  | 'contact'
  | 'placement'
  | 'display'
  | 'share'

const TEXT_KEYS: TextKey[] = [
  'cafe_name',
  'tagline',
  'logo_url',
  'hero_title',
  'hero_subtitle',
  'footer_text',
  'address',
  'phone',
  'instagram',
  'working_hours',
  'maps_url',
  'og_title',
  'og_description',
  'og_image_url',
  'hero_bg_image_url',
  'bg_image_url',
]

const BOOL_DEFAULTS: Record<BoolKey, boolean> = {
  og_enabled: true,
  show_address: true,
  show_phone: true,
  show_instagram: true,
  show_working_hours: true,
  show_quote: true,
  show_share_button: true,
  show_featured_filter: true,
  show_product_images: true,
  show_product_size: true,
  show_footer: true,
  bg_enabled: false,
  floating_enabled: false,
  address_in_header: true,
  address_in_footer: true,
  address_in_floating: false,
  phone_in_header: true,
  phone_in_footer: true,
  phone_in_floating: false,
  instagram_in_header: true,
  instagram_in_footer: true,
  instagram_in_floating: false,
  hours_in_header: true,
  hours_in_footer: true,
}

const BOOL_KEYS = Object.keys(BOOL_DEFAULTS) as BoolKey[]

const EMPTY: Settings = {
  ...(Object.fromEntries(TEXT_KEYS.map((k) => [k, ''])) as Record<TextKey, string>),
  ...BOOL_DEFAULTS,
  hero_bg_mode: 'color',
  contact_header_style: 'icons',
  floating_side: 'right',
  hero_overlay: 45,
  bg_overlay: 88,
  bg_gallery: [],
}

function clampNum(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

function normalize(data: Record<string, unknown> | null): Settings {
  const result: Settings = { ...EMPTY, bg_gallery: [] }
  if (!data) return result

  for (const key of TEXT_KEYS) {
    const val = data[key]
    result[key] = typeof val === 'string' ? val : ''
  }
  for (const key of BOOL_KEYS) {
    const val = data[key]
    result[key] = typeof val === 'boolean' ? val : BOOL_DEFAULTS[key]
  }

  result.hero_bg_mode = data.hero_bg_mode === 'image' ? 'image' : 'color'
  result.contact_header_style = data.contact_header_style === 'text' ? 'text' : 'icons'
  result.floating_side = data.floating_side === 'left' ? 'left' : 'right'
  result.hero_overlay = clampNum(data.hero_overlay, 0, 80, 45)
  result.bg_overlay = clampNum(data.bg_overlay, 0, 98, 88)
  result.bg_gallery = Array.isArray(data.bg_gallery)
    ? data.bg_gallery.filter((u): u is string => typeof u === 'string')
    : []

  return result
}

/* ============================================================
   پردازش و آپلود تصویر (سمت مرورگر، با نشست ادمین)
   ============================================================ */

class UserError extends Error {}

type Process =
  | { kind: 'cover'; w: number; h: number; minW: number }
  | { kind: 'max'; w: number; minW: number }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad image'))
    }
    img.src = url
  })
}

// برش وسط‌چین به اندازه استاندارد (cover) یا فقط کوچک‌کردن (max)
async function processImage(file: File, p: Process): Promise<Blob> {
  const img = await loadImage(file).catch(() => {
    throw new UserError('تصویر خوانده نشد. فرمت JPG یا PNG را امتحان کن.')
  })

  if (img.naturalWidth < p.minW) {
    throw new UserError(
      `تصویر خیلی کوچک است؛ عرض آن باید حداقل ${p.minW.toLocaleString('fa-IR')} پیکسل باشد.`
    )
  }

  let w: number
  let h: number
  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight

  if (p.kind === 'cover') {
    w = p.w
    h = p.h
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    sw = w / scale
    sh = h / scale
    sx = (img.naturalWidth - sw) / 2
    sy = (img.naturalHeight - sh) / 2
  } else {
    const scale = Math.min(1, p.w / img.naturalWidth)
    w = Math.round(img.naturalWidth * scale)
    h = Math.round(img.naturalHeight * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new UserError('مرورگر از پردازش تصویر پشتیبانی نمی‌کند.')

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.85
    )
  )
}

async function prepareAndUpload(file: File, folder: string, p: Process) {
  if (!file.type.startsWith('image/')) throw new UserError('فایل باید تصویر باشد.')
  if (file.size > 8 * 1024 * 1024) {
    throw new UserError('حجم تصویر باید کمتر از ۸ مگابایت باشد.')
  }

  const blob = await processImage(file, p)
  const db = supabaseBrowser()
  const path = `settings/${folder}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.jpg`

  const { error } = await db.storage
    .from('product-images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error

  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

const errText = (err: unknown) =>
  err instanceof UserError ? err.message : 'آپلود نشد. دوباره تلاش کن.'

/* ============================================================
   کامپوننت‌های کوچک فرم
   ============================================================ */

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      <span className="switch-label">{label}</span>
    </label>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PlaceChip({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className={`place-chip ${checked ? 'on' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="field field-wide">
      <div className="field-head">
        <label>{label}</label>
        <span className="range-value">{value.toLocaleString('fa-IR')}٪</span>
      </div>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </div>
  )
}

function ImageField({
  label,
  hint,
  value,
  onChange,
  folder,
  process,
  wide,
}: {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  folder: string
  process: Process
  wide?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')
    setUploading(true)
    try {
      onChange(await prepareAndUpload(file, folder, process))
    } catch (err) {
      console.error(err)
      setError(errText(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="field field-wide">
      <label>{label}</label>
      <div className="imgf-box">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={`imgf-preview ${wide ? 'wide' : ''}`} src={value} alt="" />
        ) : (
          <div className={`imgf-preview empty ${wide ? 'wide' : ''}`}>🖼️</div>
        )}

        <div className="imgf-actions">
          <label className="btn imgf-pick">
            {uploading ? 'در حال آپلود…' : value ? 'تغییر تصویر' : 'انتخاب تصویر'}
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={uploading}
              hidden
            />
          </label>
          {value && !uploading && (
            <button type="button" className="btn danger" onClick={() => onChange('')}>
              حذف
            </button>
          )}
        </div>
      </div>
      {hint && <small>{hint}</small>}
      {error && <small className="imgf-error">{error}</small>}
    </div>
  )
}

const GALLERY_MAX = 12

function GalleryField({
  items,
  selected,
  onAdd,
  onRemove,
  onSelect,
}: {
  items: string[]
  selected: string
  onAdd: (url: string) => void
  onRemove: (url: string) => void
  onSelect: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files: File[] = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    setError('')
    setUploading(true)
    try {
      let count = items.length
      for (const file of files) {
        if (count >= GALLERY_MAX) {
          setError(`حداکثر ${GALLERY_MAX.toLocaleString('fa-IR')} تصویر مجاز است.`)
          break
        }
        onAdd(await prepareAndUpload(file, 'bg', { kind: 'max', w: 1400, minW: 600 }))
        count += 1
      }
    } catch (err) {
      console.error(err)
      setError(errText(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="field field-wide">
      <label>مجموعه تصاویر پس‌زمینه</label>
      <div className="gal">
        {items.map((url) => (
          <div key={url} className={`gal-item ${url === selected ? 'selected' : ''}`}>
            <button
              type="button"
              className="gal-pick"
              style={{ backgroundImage: `url("${url}")` }}
              onClick={() => onSelect(url)}
              aria-label="انتخاب این تصویر"
              aria-pressed={url === selected}
            />
            {url === selected && <span className="gal-check">✓</span>}
            <button
              type="button"
              className="gal-del"
              onClick={() => onRemove(url)}
              aria-label="حذف از مجموعه"
              title="حذف از مجموعه"
            >
              ✕
            </button>
          </div>
        ))}

        {items.length < GALLERY_MAX && (
          <label className="gal-add">
            <span>{uploading ? '…' : '+'}</span>
            <small>{uploading ? 'در حال آپلود' : 'افزودن'}</small>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              disabled={uploading}
              hidden
            />
          </label>
        )}
      </div>
      <small>
        روی یک تصویر بزن تا انتخاب شود. تصویرها خودکار کوچک و بهینه می‌شوند
        (حداقل عرض ۶۰۰ پیکسل). حذف از مجموعه، فایل را از فضای ذخیره‌سازی پاک
        نمی‌کند.
      </small>
      {error && <small className="imgf-error">{error}</small>}
    </div>
  )
}

/* ============================================================
   بخش‌های صفحه
   ============================================================ */

const SECTIONS: Array<{ key: SectionKey; icon: string; title: string; desc: string }> = [
  { key: 'basic', icon: '☕', title: 'هویت و اطلاعات اصلی', desc: 'نام، شعار و لوگوی کافه' },
  { key: 'header', icon: '🎨', title: 'متن‌های هدر و فوتر', desc: 'عنوان و زیرعنوان جایگزین، متن فوتر' },
  { key: 'appearance', icon: '🖼️', title: 'ظاهر هدر و پس‌زمینه', desc: 'رنگ یا تصویر هدر، پس‌زمینه صفحه با لایه سفید' },
  { key: 'contact', icon: '📞', title: 'اطلاعات تماس', desc: 'آدرس، تلفن، ساعت کاری، اینستاگرام و نقشه' },
  { key: 'placement', icon: '📍', title: 'جای نمایش اطلاعات تماس', desc: 'هدر، فوتر یا دکمه شناور؛ آیکن یا متن' },
  { key: 'display', icon: '👁️', title: 'نمایش در منو', desc: 'روشن و خاموش کردن بخش‌های منو' },
  { key: 'share', icon: '🔗', title: 'پیش‌نمایش لینک', desc: 'ظاهر لینک در تلگرام، واتساپ و پیام‌رسان‌ها' },
]

const DISPLAY_TOGGLES: Array<{ key: BoolKey; title: string; hint: string }> = [
  { key: 'show_quote', title: 'جمله بالای منو', hint: 'نوار نقل‌قول زیر هدر' },
  { key: 'show_share_button', title: 'دکمه اشتراک‌گذاری', hint: 'دکمه «اشتراک‌گذاری منو» در هدر' },
  { key: 'show_featured_filter', title: 'فیلتر «پیشنهاد کافه»', hint: 'چیپ ستاره‌دار کنار جستجو' },
  { key: 'show_product_images', title: 'عکس محصولات', hint: 'اگر خاموش باشد منو فقط متنی می‌شود' },
  { key: 'show_product_size', title: 'اندازه محصول', hint: 'مثلاً «۲۲۰ میلی‌لیتر» کنار قیمت' },
  { key: 'show_footer', title: 'متن فوتر', hint: 'متن پایین صفحه' },
]

const PLACEMENT: Array<{
  key: 'address' | 'phone' | 'instagram' | 'hours'
  title: string
  master: BoolKey
  header: BoolKey
  footer: BoolKey
  floating?: BoolKey
}> = [
  { key: 'address', title: 'آدرس', master: 'show_address', header: 'address_in_header', footer: 'address_in_footer', floating: 'address_in_floating' },
  { key: 'phone', title: 'تلفن', master: 'show_phone', header: 'phone_in_header', footer: 'phone_in_footer', floating: 'phone_in_floating' },
  { key: 'instagram', title: 'اینستاگرام', master: 'show_instagram', header: 'instagram_in_header', footer: 'instagram_in_footer', floating: 'instagram_in_floating' },
  { key: 'hours', title: 'ساعت کاری', master: 'show_working_hours', header: 'hours_in_header', footer: 'hours_in_footer' },
]

function previewOf(key: SectionKey, f: Settings): string {
  switch (key) {
    case 'basic':
      return f.cafe_name || 'تنظیم نشده'
    case 'header':
      return f.hero_title || f.tagline || 'پیش‌فرض'
    case 'appearance':
      return `هدر: ${f.hero_bg_mode === 'image' ? 'تصویر' : 'رنگ ثابت'}${
        f.bg_enabled ? ' · پس‌زمینه فعال' : ''
      }`
    case 'contact':
      return f.address || f.phone || 'تنظیم نشده'
    case 'placement':
      return `هدر: ${f.contact_header_style === 'icons' ? 'آیکن' : 'متن'}${
        f.floating_enabled ? ' · دکمه شناور فعال' : ''
      }`
    case 'display': {
      const flags = DISPLAY_TOGGLES.map((t) => f[t.key])
      const on = flags.filter(Boolean).length
      return `${on.toLocaleString('fa-IR')} از ${flags.length.toLocaleString('fa-IR')} بخش فعال`
    }
    case 'share':
      return f.og_enabled ? f.og_title || 'پیش‌فرض' : 'غیرفعال'
  }
}

/* ============================================================
   صفحه
   ============================================================ */

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

  const setText = (name: TextKey, value: string) =>
    setDraft((d) => ({ ...d, [name]: value }))

  const setBool = (name: BoolKey, value: boolean) =>
    setDraft((d) => ({ ...d, [name]: value }))

  // مجموعه تصاویر پس‌زمینه
  const addToGallery = (url: string) =>
    setDraft((d) => ({
      ...d,
      bg_gallery: [...d.bg_gallery, url],
      bg_image_url: d.bg_image_url || url,
    }))

  const removeFromGallery = (url: string) =>
    setDraft((d) => {
      const rest = d.bg_gallery.filter((u) => u !== url)
      return {
        ...d,
        bg_gallery: rest,
        bg_image_url: d.bg_image_url === url ? rest[0] ?? '' : d.bg_image_url,
      }
    })

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
        throw new Error(
          res.status === 400 && err.error ? err.error : 'ذخیره نشد، دوباره تلاش کن'
        )
      }

      // منوی عمومی (و پیش‌نمایش لینک) را فوراً به‌روز کن
      await revalidateMenu().catch(() => {})

      setForm(draft)
      setMessage('✅ تنظیمات ذخیره شد')
      setTimeout(() => {
        closeSection()
      }, 1000)
    } catch (err) {
      console.error(err)
      setMessage(`❌ ${err instanceof Error ? err.message : 'ذخیره نشد، دوباره تلاش کن'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="admin">در حال بارگذاری...</div>
  }

  /* ---------- فیلدهای فرم ---------- */

  const text = (
    name: TextKey,
    label: string,
    opts: {
      placeholder?: string
      ltr?: boolean
      rows?: number
      hint?: string
      autoFocus?: boolean
    } = {}
  ) => (
    <div className="field field-wide" key={name}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {opts.rows ? (
        <textarea
          id={`f-${name}`}
          value={draft[name]}
          onChange={(e) => setText(name, e.target.value)}
          placeholder={opts.placeholder}
          rows={opts.rows}
          autoFocus={opts.autoFocus}
        />
      ) : (
        <input
          id={`f-${name}`}
          value={draft[name]}
          onChange={(e) => setText(name, e.target.value)}
          placeholder={opts.placeholder}
          dir={opts.ltr ? 'ltr' : undefined}
          autoFocus={opts.autoFocus}
        />
      )}
      {opts.hint && <small>{opts.hint}</small>}
    </div>
  )

  const textWithSwitch = (
    name: TextKey,
    flag: BoolKey,
    label: string,
    opts: { placeholder?: string; ltr?: boolean } = {}
  ) => (
    <div className={`field field-wide ${draft[flag] ? '' : 'is-off'}`} key={name}>
      <div className="field-head">
        <label htmlFor={`f-${name}`}>{label}</label>
        <Switch
          checked={draft[flag]}
          onChange={(v) => setBool(flag, v)}
          label="نمایش در منو"
        />
      </div>
      <input
        id={`f-${name}`}
        value={draft[name]}
        onChange={(e) => setText(name, e.target.value)}
        placeholder={opts.placeholder}
        dir={opts.ltr ? 'ltr' : undefined}
      />
    </div>
  )

  function renderSection() {
    switch (activeSection) {
      case 'basic':
        return (
          <>
            {text('cafe_name', 'نام کافه', { placeholder: 'کافه پارک', autoFocus: true })}
            {text('tagline', 'شعار / زیرنویس هدر', {
              placeholder: 'پارک سلامت شیراز · قهوه، نوشیدنی و غذا',
              rows: 2,
            })}
            <ImageField
              label="لوگوی کافه (اختیاری)"
              hint="تصویر خودکار به‌صورت مربع ۲۵۶×۲۵۶ برش می‌خورد و بالای هدر منو نمایش داده می‌شود."
              value={draft.logo_url}
              onChange={(url) => setText('logo_url', url)}
              folder="logo"
              process={{ kind: 'cover', w: 256, h: 256, minW: 200 }}
            />
          </>
        )

      case 'header':
        return (
          <>
            {text('hero_title', 'عنوان جایگزین هدر (اختیاری)', {
              placeholder: 'اگه خالی باشه، نام کافه استفاده می‌شه',
            })}
            {text('hero_subtitle', 'زیرعنوان جایگزین هدر (اختیاری)', {
              placeholder: 'اگه خالی باشه، شعار استفاده می‌شه',
            })}
            {text('footer_text', 'متن فوتر', {
              placeholder: 'کافه پارک · پارک سلامت شیراز',
              hint: 'نمایش یا مخفی کردن این متن در بخش «نمایش در منو» است.',
            })}
          </>
        )

      case 'appearance':
        return (
          <>
            <div className="field field-wide">
              <label>پس‌زمینه هدر</label>
              <Segmented
                value={draft.hero_bg_mode}
                options={
                  [
                    { value: 'color', label: 'رنگ ثابت' },
                    { value: 'image', label: 'تصویر' },
                  ] as const
                }
                onChange={(v) => setDraft((d) => ({ ...d, hero_bg_mode: v }))}
              />
              {draft.hero_bg_mode === 'color' && (
                <small>
                  رنگ هدر از «قالب‌ها» (رنگ اصلی و رنگ تأکیدی) می‌آید.
                </small>
              )}
            </div>

            {draft.hero_bg_mode === 'image' && (
              <>
                <ImageField
                  label="تصویر هدر"
                  hint="تصویر خودکار به اندازه استاندارد هدر (۱۶۰۰×۶۰۰) از وسط برش می‌خورد؛ پس سوژه را وسط تصویر بگیر. حداقل عرض ۱۰۰۰ پیکسل."
                  value={draft.hero_bg_image_url}
                  onChange={(url) => setText('hero_bg_image_url', url)}
                  folder="hero"
                  process={{ kind: 'cover', w: 1600, h: 600, minW: 1000 }}
                  wide
                />
                <RangeField
                  label="تیرگی روی تصویر"
                  min={0}
                  max={80}
                  value={draft.hero_overlay}
                  onChange={(v) => setDraft((d) => ({ ...d, hero_overlay: v }))}
                  hint="متن سفید هدر با کمی تیرگی خواناتر می‌شود. اگر تصویر روشن است عدد را بالاتر ببر."
                />
              </>
            )}

            <hr className="sec-divider" />

            <div className="toggle-row">
              <div>
                <strong>پس‌زمینه تصویری صفحه</strong>
                <small>
                  یک تصویر از مجموعه، با لایه سفیدِ محوکننده زیر محتوای منو.
                </small>
              </div>
              <Switch
                checked={draft.bg_enabled}
                onChange={(v) => setBool('bg_enabled', v)}
                label={draft.bg_enabled ? 'روشن' : 'خاموش'}
              />
            </div>

            {draft.bg_enabled && (
              <div style={{ marginTop: 14 }}>
                <GalleryField
                  items={draft.bg_gallery}
                  selected={draft.bg_image_url}
                  onAdd={addToGallery}
                  onRemove={removeFromGallery}
                  onSelect={(url) => setText('bg_image_url', url)}
                />

                <RangeField
                  label="شدت لایه سفید"
                  min={40}
                  max={98}
                  value={draft.bg_overlay}
                  onChange={(v) => setDraft((d) => ({ ...d, bg_overlay: v }))}
                  hint="هرچه بیشتر باشد، تصویر محوتر و متن‌ها خواناتر می‌شوند."
                />

                {draft.bg_image_url ? (
                  <div
                    className="bgprev"
                    style={{ backgroundImage: `url("${draft.bg_image_url}")` }}
                  >
                    <div
                      className="bgprev-wash"
                      style={{ opacity: draft.bg_overlay / 100 }}
                    />
                    <div className="bgprev-card">پیش‌نمایش کارت محصول</div>
                  </div>
                ) : (
                  <small>یک تصویر اضافه و انتخاب کن تا پیش‌نمایش دیده شود.</small>
                )}
              </div>
            )}
          </>
        )

      case 'contact':
        return (
          <>
            {textWithSwitch('address', 'show_address', 'آدرس', {
              placeholder: 'شیراز، پارک سلامت',
            })}
            {text('maps_url', 'لینک نقشه (اختیاری)', {
              placeholder: 'https://maps.app.goo.gl/...',
              ltr: true,
              hint: 'اگر پر باشد، آدرس به این لینک (مسیریابی) وصل می‌شود و می‌تواند آیکن شود.',
            })}
            {textWithSwitch('phone', 'show_phone', 'شماره تماس', {
              placeholder: '071-xxxxxxxx',
              ltr: true,
            })}
            {textWithSwitch('instagram', 'show_instagram', 'اینستاگرام', {
              placeholder: '@cafepark',
              ltr: true,
            })}
            {textWithSwitch('working_hours', 'show_working_hours', 'ساعت کاری', {
              placeholder: 'هر روز ۹ صبح تا ۱۲ شب',
            })}
            <small>
              جای نمایش هر مورد (هدر، فوتر یا دکمه شناور) را در بخش «جای نمایش
              اطلاعات تماس» انتخاب کن.
            </small>
          </>
        )

      case 'placement':
        return (
          <>
            <div className="field field-wide">
              <label>سبک نمایش در هدر</label>
              <Segmented
                value={draft.contact_header_style}
                options={
                  [
                    { value: 'icons', label: 'آیکن' },
                    { value: 'text', label: 'متن' },
                  ] as const
                }
                onChange={(v) => setDraft((d) => ({ ...d, contact_header_style: v }))}
              />
              <small>
                در حالت آیکن، تلفن، نقشه و اینستاگرام دکمه‌های گرد و کم‌جا می‌شوند.
                آدرس فقط وقتی «لینک نقشه» پر باشد آیکن می‌شود، وگرنه به‌صورت متن
                می‌ماند؛ ساعت کاری همیشه متن است.
              </small>
            </div>

            <div className="place-list">
              {PLACEMENT.map((item) => (
                <div
                  className={`place-row ${draft[item.master] ? '' : 'is-off'}`}
                  key={item.key}
                >
                  <div className="place-name">
                    <span>{item.title}</span>
                    {!draft[item.master] && (
                      <small>در بخش «اطلاعات تماس» خاموش است</small>
                    )}
                  </div>
                  <div className="place-chips">
                    <PlaceChip
                      label="هدر"
                      checked={draft[item.header]}
                      onChange={(v) => setBool(item.header, v)}
                    />
                    <PlaceChip
                      label="فوتر"
                      checked={draft[item.footer]}
                      onChange={(v) => setBool(item.footer, v)}
                    />
                    {item.floating && (
                      <PlaceChip
                        label="شناور"
                        checked={draft[item.floating]}
                        onChange={(v) => setBool(item.floating as BoolKey, v)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="toggle-row" style={{ marginTop: 14 }}>
              <div>
                <strong>دکمه شناور تماس</strong>
                <small>
                  یک دکمه گرد در گوشه همه صفحه‌های منو؛ با لمس آن، موردهایی که
                  «شناور» انتخاب کرده‌ای (تماس، مسیریابی، اینستاگرام) باز می‌شوند.
                </small>
              </div>
              <Switch
                checked={draft.floating_enabled}
                onChange={(v) => setBool('floating_enabled', v)}
                label={draft.floating_enabled ? 'روشن' : 'خاموش'}
              />
            </div>

            {draft.floating_enabled && (
              <div className="field field-wide" style={{ marginTop: 12 }}>
                <label>سمت دکمه شناور</label>
                <Segmented
                  value={draft.floating_side}
                  options={
                    [
                      { value: 'right', label: 'راست' },
                      { value: 'left', label: 'چپ' },
                    ] as const
                  }
                  onChange={(v) => setDraft((d) => ({ ...d, floating_side: v }))}
                />
                <small>
                  دکمه فقط وقتی دیده می‌شود که حداقل یک مورد را «شناور» کرده باشی.
                </small>
              </div>
            )}
          </>
        )

      case 'display':
        return (
          <div className="toggle-list">
            {DISPLAY_TOGGLES.map((t) => (
              <div className="toggle-row" key={t.key}>
                <div>
                  <strong>{t.title}</strong>
                  <small>{t.hint}</small>
                </div>
                <Switch
                  checked={draft[t.key]}
                  onChange={(v) => setBool(t.key, v)}
                  label={draft[t.key] ? 'روشن' : 'خاموش'}
                />
              </div>
            ))}
          </div>
        )

      case 'share':
        return (
          <>
            <div className="toggle-row" style={{ marginBottom: 14 }}>
              <div>
                <strong>پیش‌نمایش اختصاصی لینک</strong>
                <small>
                  اگر خاموش باشد، فقط عنوان و توضیح ساده صفحه استفاده می‌شود.
                </small>
              </div>
              <Switch
                checked={draft.og_enabled}
                onChange={(v) => setBool('og_enabled', v)}
                label={draft.og_enabled ? 'روشن' : 'خاموش'}
              />
            </div>

            <div className={draft.og_enabled ? '' : 'is-off-group'}>
              {text('og_title', 'عنوان پیش‌نمایش', {
                placeholder: 'اگه خالی باشه، «منوی نام کافه» استفاده می‌شه',
              })}
              {text('og_description', 'توضیح پیش‌نمایش', {
                placeholder: 'اگه خالی باشه، شعار کافه استفاده می‌شه',
                rows: 2,
              })}
              <ImageField
                label="تصویر پیش‌نمایش"
                hint="خودکار به اندازه استاندارد ۱۲۰۰×۶۳۰ برش می‌خورد. تلگرام و واتساپ تصویر را کش می‌کنند؛ بعد از تغییر ممکن است چند ساعت طول بکشد."
                value={draft.og_image_url}
                onChange={(url) => setText('og_image_url', url)}
                folder="og"
                process={{ kind: 'cover', w: 1200, h: 630, minW: 800 }}
                wide
              />
            </div>
          </>
        )

      default:
        return null
    }
  }

  const activeMeta = SECTIONS.find((s) => s.key === activeSection)

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>تنظیمات کافه</h1>
        <p className="admin-subtitle">روی هر بخش کلیک کن تا ویرایشش کنی</p>
      </div>

      {message && !activeSection && <div className="admin-message">{message}</div>}

      <div className="settings-cards">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            className="settings-card"
            onClick={() => openSection(section.key)}
          >
            <span className="settings-card-icon">{section.icon}</span>

            <div className="settings-card-content">
              <strong>{section.title}</strong>
              <small>{previewOf(section.key, form)}</small>
            </div>

            <span className="settings-card-arrow">‹</span>
          </button>
        ))}
      </div>

      <Modal
        isOpen={activeSection !== null}
        onClose={closeSection}
        title={activeMeta?.title ?? ''}
        subtitle={activeMeta?.desc ?? ''}
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
          {message && <div className="admin-message">{message}</div>}
          {renderSection()}
        </form>
      </Modal>
    </div>
  )
}
