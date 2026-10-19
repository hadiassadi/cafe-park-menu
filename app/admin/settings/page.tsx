'use client'

import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { revalidateMenu } from '../actions'

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
  | 'card_number'
  | 'card_holder'
  | 'bank_name'
  | 'sheba_number'
  | 'payment_note'
  | 'cafe_phone'
  | 'eitaa_id'
  | 'bale_id'
  | 'rubika_id'

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
  | 'payment_enabled'
  | 'request_card_enabled'
  | 'whatsapp_enabled'
  | 'eitaa_enabled'
  | 'bale_enabled'
  | 'rubika_enabled'
  // ✅ جدید
  | 'admin_allow_delete_orders'

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
  | 'payment'
  | 'messengers'
  | 'display'
  | 'share'
  | 'security' // ✅ جدید

const TEXT_KEYS: TextKey[] = [
  'cafe_name', 'tagline', 'logo_url', 'hero_title', 'hero_subtitle',
  'footer_text', 'address', 'phone', 'instagram', 'working_hours',
  'maps_url', 'og_title', 'og_description', 'og_image_url',
  'hero_bg_image_url', 'bg_image_url',
  'card_number', 'card_holder', 'bank_name', 'sheba_number', 'payment_note',
  'cafe_phone', 'eitaa_id', 'bale_id', 'rubika_id',
]

const BOOL_DEFAULTS: Record<BoolKey, boolean> = {
  og_enabled: true,
  show_address: true, show_phone: true, show_instagram: true,
  show_working_hours: true, show_quote: true, show_share_button: true,
  show_featured_filter: true, show_product_images: true,
  show_product_size: true, show_footer: true,
  bg_enabled: false, floating_enabled: false,
  address_in_header: true, address_in_footer: true, address_in_floating: false,
  phone_in_header: true, phone_in_footer: true, phone_in_floating: false,
  instagram_in_header: true, instagram_in_footer: true, instagram_in_floating: false,
  hours_in_header: true, hours_in_footer: true,
  payment_enabled: false, request_card_enabled: true,
  whatsapp_enabled: true, eitaa_enabled: false, bale_enabled: false, rubika_enabled: false,
  // ✅ جدید: پیش‌فرض روشن
  admin_allow_delete_orders: true,
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
   پردازش و آپلود تصویر
   ============================================================ */

class UserError extends Error {}

type Process =
  | { kind: 'cover'; w: number; h: number; minW: number }
  | { kind: 'max'; w: number; minW: number }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}

async function processImage(file: File, p: Process): Promise<Blob> {
  const img = await loadImage(file).catch(() => {
    throw new UserError('تصویر خوانده نشد. فرمت JPG یا PNG را امتحان کن.')
  })

  if (img.naturalWidth < p.minW) {
    throw new UserError(
      `تصویر خیلی کوچک است؛ عرض آن باید حداقل ${p.minW.toLocaleString('fa-IR')} پیکسل باشد.`
    )
  }

  let w: number, h: number, sx = 0, sy = 0
  let sw = img.naturalWidth, sh = img.naturalHeight

  if (p.kind === 'cover') {
    w = p.w; h = p.h
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    sw = w / scale; sh = h / scale
    sx = (img.naturalWidth - sw) / 2
    sy = (img.naturalHeight - sh) / 2
  } else {
    const scale = Math.min(1, p.w / img.naturalWidth)
    w = Math.round(img.naturalWidth * scale)
    h = Math.round(img.naturalHeight * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
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

const errText = (err: unknown) =>
  err instanceof UserError ? err.message : 'آپلود نشد. دوباره تلاش کن.'

async function prepareAndUpload(file: File, folder: string, p: Process) {
  if (!file.type.startsWith('image/')) throw new UserError('فایل باید تصویر باشد.')
  if (file.size > 8 * 1024 * 1024) {
    throw new UserError('حجم تصویر باید کمتر از ۸ مگابایت باشد.')
  }

  const blob = await processImage(file, p)

  const formData = new FormData()
  formData.append('file', blob)
  formData.append('folder', folder)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok || !data.url) throw new UserError(data.error || 'آپلود نشد')

  return data.url
}

/* ============================================================
   کامپوننت‌های کوچک
   ============================================================ */

function Switch({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
      <span className="switch-label">{label}</span>
    </label>
  )
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PlaceChip({ checked, onChange, label, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className={`place-chip ${checked ? 'on' : ''} ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function RangeField({ label, value, min, max, onChange, hint }: {
  label: string; value: number; min: number; max: number
  onChange: (v: number) => void; hint?: string
}) {
  return (
    <div className="field field-wide">
      <div className="field-head">
        <label>{label}</label>
        <span className="range-value">{value.toLocaleString('fa-IR')}٪</span>
      </div>
      <input type="range" className="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <small>{hint}</small>}
    </div>
  )
}

function ImageField({ label, hint, value, onChange, folder, process, wide }: {
  label: string; hint?: string; value: string
  onChange: (url: string) => void
  folder: string; process: Process; wide?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(''); setUploading(true)
    try {
      onChange(await prepareAndUpload(file, folder, process))
    } catch (err) {
      console.error(err); setError(errText(err))
    } finally { setUploading(false) }
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
            <input type="file" accept="image/*" onChange={handleFile}
              disabled={uploading} hidden />
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

function GalleryField({ items, selected, onAdd, onRemove, onSelect }: {
  items: string[]; selected: string
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
    setError(''); setUploading(true)
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
      console.error(err); setError(errText(err))
    } finally { setUploading(false) }
  }

  return (
    <div className="field field-wide">
      <label>مجموعه تصاویر پس‌زمینه</label>
      <div className="gal">
        {items.map((url) => (
          <div key={url} className={`gal-item ${url === selected ? 'selected' : ''}`}>
            <button type="button" className="gal-pick"
              style={{ backgroundImage: `url("${url}")` }}
              onClick={() => onSelect(url)}
              aria-label="انتخاب این تصویر"
              aria-pressed={url === selected} />
            {url === selected && <span className="gal-check">✓</span>}
            <button type="button" className="gal-del"
              onClick={() => onRemove(url)}
              aria-label="حذف از مجموعه" title="حذف از مجموعه">✕</button>
          </div>
        ))}
        {items.length < GALLERY_MAX && (
          <label className="gal-add">
            <span>{uploading ? '…' : '+'}</span>
            <small>{uploading ? 'در حال آپلود' : 'افزودن'}</small>
            <input type="file" accept="image/*" multiple onChange={handleFiles}
              disabled={uploading} hidden />
          </label>
        )}
      </div>
      <small>روی یک تصویر بزن تا انتخاب شود.</small>
      {error && <small className="imgf-error">{error}</small>}
    </div>
  )
}

/* ============================================================
   بخش‌های صفحه
   ============================================================ */

const SECTIONS: Array<{ key: SectionKey; icon: string; title: string; desc: string }> = [
  { key: 'basic', icon: '☕', title: 'هویت و اطلاعات اصلی', desc: 'نام، شعار و لوگوی کافه' },
  { key: 'header', icon: '🎨', title: 'متن‌های هدر و فوتر', desc: 'عنوان و زیرعنوان، متن فوتر' },
  { key: 'appearance', icon: '🖼️', title: 'ظاهر هدر و پس‌زمینه', desc: 'رنگ یا تصویر هدر' },
  { key: 'contact', icon: '📞', title: 'اطلاعات تماس', desc: 'آدرس، تلفن، اینستاگرام، ساعت کاری' },
  { key: 'payment', icon: '💳', title: 'اطلاعات پرداخت', desc: 'شماره کارت، شبا و توضیحات' },
  { key: 'messengers', icon: '💬', title: 'پیام‌رسان‌ها', desc: 'واتساپ، ایتا، بله، روبیکا' },
  { key: 'display', icon: '👁️', title: 'نمایش در منو', desc: 'روشن و خاموش کردن بخش‌ها' },
  { key: 'share', icon: '🔗', title: 'پیش‌نمایش لینک', desc: 'ظاهر لینک در پیام‌رسان‌ها' },
  // ✅ جدید
  { key: 'security', icon: '🔒', title: 'امنیت و دسترسی', desc: 'کنترل عملیات حساس پنل' },
]

const DISPLAY_TOGGLES: Array<{ key: BoolKey; title: string; hint: string }> = [
  { key: 'show_quote', title: 'جمله بالای منو', hint: 'نوار نقل‌قول زیر هدر' },
  { key: 'show_share_button', title: 'دکمه اشتراک‌گذاری', hint: 'در هدر' },
  { key: 'show_featured_filter', title: 'فیلتر «پیشنهاد کافه»', hint: 'چیپ ستاره‌دار' },
  { key: 'show_product_images', title: 'عکس محصولات', hint: 'اگر خاموش باشد منو متنی می‌شود' },
  { key: 'show_product_size', title: 'اندازه محصول', hint: 'کنار قیمت' },
  { key: 'show_footer', title: 'متن فوتر', hint: 'پایین صفحه' },
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

const CONTACT_FIELDS: Record<
  'address' | 'phone' | 'instagram' | 'hours',
  { name: TextKey; placeholder: string; ltr?: boolean; hint: string }
> = {
  address: { name: 'address', placeholder: 'شیراز، پارک سلامت', hint: 'آیکن نقشه فقط با لینک نقشه.' },
  phone: { name: 'phone', placeholder: '071-xxxxxxxx', ltr: true, hint: 'با لمس، تماس.' },
  instagram: { name: 'instagram', placeholder: '@cafepark', ltr: true, hint: 'با لمس، اینستاگرام.' },
  hours: { name: 'working_hours', placeholder: 'هر روز ۹ صبح تا ۱۲ شب', hint: 'فقط متن.' },
}

function previewOf(key: SectionKey, f: Settings): string {
  switch (key) {
    case 'basic': return f.cafe_name || 'تنظیم نشده'
    case 'header': return f.hero_title || f.tagline || 'پیش‌فرض'
    case 'appearance':
      return `هدر: ${f.hero_bg_mode === 'image' ? 'تصویر' : 'رنگ ثابت'}${f.bg_enabled ? ' · پس‌زمینه فعال' : ''}`
    case 'contact':
      return `${f.address || f.phone || 'تنظیم نشده'}${f.floating_enabled ? ' · شناور' : ''}`
    case 'payment':
      return f.card_number
        ? `کارت: ${f.card_number.slice(-4).padStart(4, '•')}`
        : f.payment_enabled ? 'فعال — شماره کارت تنظیم نشده' : 'غیرفعال'
    case 'messengers': {
      const flags = [f.whatsapp_enabled, f.eitaa_enabled, f.bale_enabled, f.rubika_enabled]
      const on = flags.filter(Boolean).length
      return on === 0 ? 'هیچ پیام‌رسانی فعال نیست' : `${on.toLocaleString('fa-IR')} پیام‌رسان فعال`
    }
    case 'display': {
      const flags = DISPLAY_TOGGLES.map((t) => f[t.key])
      const on = flags.filter(Boolean).length
      return `${on.toLocaleString('fa-IR')} از ${flags.length.toLocaleString('fa-IR')} بخش فعال`
    }
    case 'share': return f.og_enabled ? f.og_title || 'پیش‌فرض' : 'غیرفعال'
    // ✅ جدید
    case 'security': return f.admin_allow_delete_orders ? 'حذف سفارش: فعال' : 'حذف سفارش: غیرفعال'
  }
}

/* ============================================================
   صفحه اصلی
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
        setForm(normalized); setDraft(normalized)
      })
      .catch(() => { setForm(EMPTY); setDraft(EMPTY) })
      .finally(() => setLoading(false))
  }, [])

  function openSection(key: SectionKey) {
    setDraft(form); setActiveSection(key); setMessage(null)
  }
  function closeSection() { setActiveSection(null); setMessage(null) }

  const setText = (name: TextKey, value: string) =>
    setDraft((d) => ({ ...d, [name]: value }))

  const setBool = (name: BoolKey, value: boolean) =>
    setDraft((d) => ({ ...d, [name]: value }))

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
    setSaving(true); setMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(res.status === 400 && err.error ? err.error : 'ذخیره نشد، دوباره تلاش کن')
      }
      await revalidateMenu().catch(() => {})
      setForm(draft)
      setMessage('✅ تنظیمات ذخیره شد')
      setTimeout(() => closeSection(), 1000)
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : 'ذخیره نشد'}`)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="admin">در حال بارگذاری...</div>

  const text = (
    name: TextKey,
    label: string,
    opts: { placeholder?: string; ltr?: boolean; rows?: number; hint?: string; autoFocus?: boolean } = {}
  ) => (
    <div className="field field-wide" key={name}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {opts.rows ? (
        <textarea id={`f-${name}`} value={draft[name]}
          onChange={(e) => setText(name, e.target.value)}
          placeholder={opts.placeholder} rows={opts.rows} autoFocus={opts.autoFocus} />
      ) : (
        <input id={`f-${name}`} value={draft[name]}
          onChange={(e) => setText(name, e.target.value)}
          placeholder={opts.placeholder} dir={opts.ltr ? 'ltr' : undefined}
          autoFocus={opts.autoFocus} />
      )}
      {opts.hint && <small>{opts.hint}</small>}
    </div>
  )

  const contactBlock = (item: (typeof PLACEMENT)[number]) => {
    const cfg = CONTACT_FIELDS[item.key]
    const on = draft[item.master]
    const floatingPicked = item.floating ? draft[item.floating] : false

    return (
      <div className={`field field-wide contact-card ${on ? '' : 'is-off'}`} key={item.key}>
        <div className="field-head">
          <label htmlFor={`f-${cfg.name}`}>{item.title}</label>
          <Switch checked={on} onChange={(v) => setBool(item.master, v)}
            label={on ? 'فعال' : 'غیرفعال'} />
        </div>
        <input id={`f-${cfg.name}`} value={draft[cfg.name]}
          onChange={(e) => setText(cfg.name, e.target.value)}
          placeholder={cfg.placeholder} dir={cfg.ltr ? 'ltr' : undefined} />
        {item.key === 'address' && (
          <div className="field">
            <label htmlFor="f-maps_url">لینک نقشه (اختیاری)</label>
            <input id="f-maps_url" dir="ltr" value={draft.maps_url}
              onChange={(e) => setText('maps_url', e.target.value)}
              placeholder="https://maps.app.goo.gl/..." />
          </div>
        )}
        <div className="place-line">
          <span className="place-label">نمایش در:</span>
          <div className="place-chips">
            <PlaceChip label="هدر" disabled={!on} checked={draft[item.header]}
              onChange={(v) => setBool(item.header, v)} />
            <PlaceChip label="فوتر" disabled={!on} checked={draft[item.footer]}
              onChange={(v) => setBool(item.footer, v)} />
            {item.floating && (
              <PlaceChip label="شناور" disabled={!on} checked={draft[item.floating]}
                onChange={(v) => setBool(item.floating as BoolKey, v)} />
            )}
          </div>
        </div>
        <small>{cfg.hint}</small>
        {on && floatingPicked && !draft.floating_enabled && (
          <small className="warn-note">«شناور» را انتخاب کرده‌ای ولی دکمه شناور روشن نشده.</small>
        )}
      </div>
    )
  }

  function renderSection() {
    switch (activeSection) {
      case 'basic':
        return (
          <>
            {text('cafe_name', 'نام کافه', { placeholder: 'کافه پارک', autoFocus: true })}
            {text('tagline', 'شعار / زیرنویس هدر', { placeholder: 'پارک سلامت شیراز · قهوه، نوشیدنی و غذا', rows: 2 })}
            <ImageField label="لوگوی کافه (اختیاری)"
              hint="۲۵۶×۲۵۶، خودکار برش می‌خورد."
              value={draft.logo_url} onChange={(url) => setText('logo_url', url)}
              folder="logo" process={{ kind: 'cover', w: 256, h: 256, minW: 200 }} />
          </>
        )
      case 'header':
        return (
          <>
            {text('hero_title', 'عنوان جایگزین هدر (اختیاری)', { placeholder: 'اگه خالی باشه، نام کافه' })}
            {text('hero_subtitle', 'زیرعنوان جایگزین هدر (اختیاری)', { placeholder: 'اگه خالی باشه، شعار' })}
            {text('footer_text', 'متن فوتر', { placeholder: 'کافه پارک · پارک سلامت شیراز' })}
          </>
        )
      case 'appearance':
        return (
          <>
            <div className="field field-wide">
              <label>پس‌زمینه هدر</label>
              <Segmented value={draft.hero_bg_mode}
                options={[{ value: 'color', label: 'رنگ ثابت' }, { value: 'image', label: 'تصویر' }] as const}
                onChange={(v) => setDraft((d) => ({ ...d, hero_bg_mode: v }))} />
            </div>
            {draft.hero_bg_mode === 'image' && (
              <>
                <ImageField label="تصویر هدر"
                  hint="۱۶۰۰×۶۰۰. حداقل عرض ۱۰۰۰."
                  value={draft.hero_bg_image_url} onChange={(url) => setText('hero_bg_image_url', url)}
                  folder="hero" process={{ kind: 'cover', w: 1600, h: 600, minW: 1000 }} wide />
                <RangeField label="تیرگی روی تصویر" min={0} max={80} value={draft.hero_overlay}
                  onChange={(v) => setDraft((d) => ({ ...d, hero_overlay: v }))} />
              </>
            )}
            <hr className="sec-divider" />
            <div className="toggle-row">
              <div><strong>پس‌زمینه تصویری صفحه</strong><small>با لایه سفید محوکننده</small></div>
              <Switch checked={draft.bg_enabled} onChange={(v) => setBool('bg_enabled', v)}
                label={draft.bg_enabled ? 'روشن' : 'خاموش'} />
            </div>
            {draft.bg_enabled && (
              <div style={{ marginTop: 14 }}>
                <GalleryField items={draft.bg_gallery} selected={draft.bg_image_url}
                  onAdd={addToGallery} onRemove={removeFromGallery}
                  onSelect={(url) => setText('bg_image_url', url)} />
                <RangeField label="شدت لایه سفید" min={40} max={98} value={draft.bg_overlay}
                  onChange={(v) => setDraft((d) => ({ ...d, bg_overlay: v }))} />
              </div>
            )}
          </>
        )
      case 'contact':
        return (
          <>
            <p className="legend">برای هر مورد مشخص کن کجا نمایش داده شود.</p>
            {PLACEMENT.map((item) => contactBlock(item))}
            <hr className="sec-divider" />
            <div className="field field-wide">
              <label>سبک نمایش در هدر</label>
              <Segmented value={draft.contact_header_style}
                options={[{ value: 'icons', label: 'آیکن' }, { value: 'text', label: 'متن' }] as const}
                onChange={(v) => setDraft((d) => ({ ...d, contact_header_style: v }))} />
            </div>
            <div className="toggle-row" style={{ marginTop: 14 }}>
              <div><strong>دکمه شناور تماس</strong><small>گوشه همه صفحه‌های منو</small></div>
              <Switch checked={draft.floating_enabled} onChange={(v) => setBool('floating_enabled', v)}
                label={draft.floating_enabled ? 'روشن' : 'خاموش'} />
            </div>
            {draft.floating_enabled && (
              <div className="field field-wide" style={{ marginTop: 12 }}>
                <label>سمت دکمه شناور</label>
                <Segmented value={draft.floating_side}
                  options={[{ value: 'right', label: 'راست' }, { value: 'left', label: 'چپ' }] as const}
                  onChange={(v) => setDraft((d) => ({ ...d, floating_side: v }))} />
              </div>
            )}
          </>
        )
      case 'payment':
        return (
          <>
            <p className="legend">اطلاعات کارت برای پرداخت کارت به کارت.</p>
            <div className="toggle-row" style={{ marginBottom: 14 }}>
              <div><strong>نمایش اطلاعات پرداخت به مشتری</strong><small>بعد از ثبت سفارش</small></div>
              <Switch checked={draft.payment_enabled} onChange={(v) => setBool('payment_enabled', v)}
                label={draft.payment_enabled ? 'روشن' : 'خاموش'} />
            </div>
            <div className={draft.payment_enabled ? '' : 'is-off-group'}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="f-card_number">شماره کارت</label>
                  <input id="f-card_number" dir="ltr" value={draft.card_number}
                    onChange={(e) => setText('card_number', e.target.value)}
                    placeholder="6037-XXXX-XXXX-XXXX" />
                </div>
                <div className="field">
                  <label htmlFor="f-card_holder">نام صاحب کارت</label>
                  <input id="f-card_holder" value={draft.card_holder}
                    onChange={(e) => setText('card_holder', e.target.value)}
                    placeholder="احمد رضایی" />
                </div>
                <div className="field">
                  <label htmlFor="f-bank_name">بانک</label>
                  <input id="f-bank_name" value={draft.bank_name}
                    onChange={(e) => setText('bank_name', e.target.value)} placeholder="ملی" />
                </div>
                <div className="field">
                  <label htmlFor="f-sheba_number">شماره شبا (اختیاری)</label>
                  <input id="f-sheba_number" dir="ltr" value={draft.sheba_number}
                    onChange={(e) => setText('sheba_number', e.target.value)} placeholder="IR..." />
                </div>
                <div className="field field-wide">
                  <label htmlFor="f-payment_note">توضیحات پرداخت (اختیاری)</label>
                  <textarea id="f-payment_note" value={draft.payment_note}
                    onChange={(e) => setText('payment_note', e.target.value)}
                    rows={2} placeholder="مثلاً: بعد از واریز، رسید را در واتساپ بفرستید" />
                </div>
              </div>
            </div>
          </>
        )
      case 'messengers':
        return (
          <>
            <p className="legend">پیام‌رسان‌هایی که مشتری می‌تواند از آن‌ها استفاده کند.</p>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field field-wide">
                <label htmlFor="f-cafe_phone">شماره واتساپ کافه (با کد کشور، بدون +)</label>
                <input id="f-cafe_phone" dir="ltr" value={draft.cafe_phone}
                  onChange={(e) => setText('cafe_phone', e.target.value)} placeholder="989301817098" />
              </div>
              <div className="field">
                <label htmlFor="f-eitaa_id">شناسه ایتا (اختیاری)</label>
                <input id="f-eitaa_id" dir="ltr" value={draft.eitaa_id}
                  onChange={(e) => setText('eitaa_id', e.target.value)} placeholder="cafepark" />
              </div>
              <div className="field">
                <label htmlFor="f-bale_id">شناسه بله (اختیاری)</label>
                <input id="f-bale_id" dir="ltr" value={draft.bale_id}
                  onChange={(e) => setText('bale_id', e.target.value)} placeholder="cafepark" />
              </div>
              <div className="field">
                <label htmlFor="f-rubika_id">شناسه روبیکا (اختیاری)</label>
                <input id="f-rubika_id" dir="ltr" value={draft.rubika_id}
                  onChange={(e) => setText('rubika_id', e.target.value)} placeholder="cafepark" />
              </div>
            </div>
            <div className="toggle-list">
              <div className="toggle-row">
                <div><strong>واتساپ</strong><small>ارسال سفارش و رسید</small></div>
                <Switch checked={draft.whatsapp_enabled} onChange={(v) => setBool('whatsapp_enabled', v)}
                  label={draft.whatsapp_enabled ? 'فعال' : 'غیرفعال'} />
              </div>
              <div className="toggle-row">
                <div><strong>ایتا</strong><small>ارسال سفارش</small></div>
                <Switch checked={draft.eitaa_enabled} onChange={(v) => setBool('eitaa_enabled', v)}
                  label={draft.eitaa_enabled ? 'فعال' : 'غیرفعال'} />
              </div>
              <div className="toggle-row">
                <div><strong>بله</strong><small>ارسال سفارش</small></div>
                <Switch checked={draft.bale_enabled} onChange={(v) => setBool('bale_enabled', v)}
                  label={draft.bale_enabled ? 'فعال' : 'غیرفعال'} />
              </div>
              <div className="toggle-row">
                <div><strong>روبیکا</strong><small>ارسال سفارش</small></div>
                <Switch checked={draft.rubika_enabled} onChange={(v) => setBool('rubika_enabled', v)}
                  label={draft.rubika_enabled ? 'فعال' : 'غیرفعال'} />
              </div>
            </div>
            <hr className="sec-divider" />
            <div className="toggle-row">
              <div><strong>درخواست شماره کارت از مدیر</strong><small>بدون پرداخت آنلاین</small></div>
              <Switch checked={draft.request_card_enabled} onChange={(v) => setBool('request_card_enabled', v)}
                label={draft.request_card_enabled ? 'فعال' : 'غیرفعال'} />
            </div>
          </>
        )
      case 'display':
        return (
          <div className="toggle-list">
            {DISPLAY_TOGGLES.map((t) => (
              <div className="toggle-row" key={t.key}>
                <div><strong>{t.title}</strong><small>{t.hint}</small></div>
                <Switch checked={draft[t.key]} onChange={(v) => setBool(t.key, v)}
                  label={draft[t.key] ? 'روشن' : 'خاموش'} />
              </div>
            ))}
          </div>
        )
      case 'share':
        return (
          <>
            <div className="toggle-row" style={{ marginBottom: 14 }}>
              <div><strong>پیش‌نمایش اختصاصی لینک</strong><small>در پیام‌رسان‌ها</small></div>
              <Switch checked={draft.og_enabled} onChange={(v) => setBool('og_enabled', v)}
                label={draft.og_enabled ? 'روشن' : 'خاموش'} />
            </div>
            <div className={draft.og_enabled ? '' : 'is-off-group'}>
              {text('og_title', 'عنوان پیش‌نمایش', { placeholder: 'اگه خالی باشه، «منوی نام کافه»' })}
              {text('og_description', 'توضیح پیش‌نمایش', { placeholder: 'اگه خالی باشه، شعار کافه', rows: 2 })}
              <ImageField label="تصویر پیش‌نمایش"
                hint="۱۲۰۰×۶۳۰."
                value={draft.og_image_url} onChange={(url) => setText('og_image_url', url)}
                folder="og" process={{ kind: 'cover', w: 1200, h: 630, minW: 800 }} wide />
            </div>
          </>
        )
      // ✅ بخش امنیت
      case 'security':
        return (
          <>
            <p className="legend">
              کنترل دسترسی به عملیات حساس در پنل ادمین.
            </p>
            <div className="toggle-row">
              <div>
                <strong>حذف سفارش از گزارش‌ها</strong>
                <small>
                  اگه روشن باشه، ادمین می‌تونه سفارش‌ها رو حذف کنه (نیاز به تأیید رمز داره). سفارش‌های حذف‌شده از گزارش‌ها حذف می‌شن ولی برای بازیابی باقی می‌مونن.
                </small>
              </div>
              <Switch
                checked={draft.admin_allow_delete_orders}
                onChange={(v) => setBool('admin_allow_delete_orders', v)}
                label={draft.admin_allow_delete_orders ? 'فعال' : 'غیرفعال'}
              />
            </div>
            {!draft.admin_allow_delete_orders && (
              <p className="legend" style={{ marginTop: 12, background: '#fdf9f4', color: '#9b3c32' }}>
                ⚠️ با غیرفعال کردن این گزینه، دکمه حذف از پنل سفارش‌ها مخفی می‌شه و API هم درخواست‌ها رو رد می‌کنه. سفارش‌های قبلاً حذف‌شده دست‌نخورده باقی می‌مونن.
              </p>
            )}
          </>
        )
      default: return null
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
          <button key={section.key} type="button" className="settings-card"
            onClick={() => openSection(section.key)}>
            <span className="settings-card-icon">{section.icon}</span>
            <div className="settings-card-content">
              <strong>{section.title}</strong>
              <small>{previewOf(section.key, form)}</small>
            </div>
            <span className="settings-card-arrow">‹</span>
          </button>
        ))}
      </div>
      <Modal isOpen={activeSection !== null} onClose={closeSection}
        title={activeMeta?.title ?? ''} subtitle={activeMeta?.desc ?? ''}
        footer={
          <>
            <button type="button" className="btn" onClick={closeSection} disabled={saving}>انصراف</button>
            <button type="submit" form="settings-form" className="btn primary-btn" disabled={saving}>
              {saving ? '...' : 'ذخیره'}
            </button>
          </>
        }>
        <form id="settings-form" onSubmit={handleSave}>
          {message && <div className="admin-message">{message}</div>}
          {renderSection()}
        </form>
      </Modal>
    </div>
  )
}