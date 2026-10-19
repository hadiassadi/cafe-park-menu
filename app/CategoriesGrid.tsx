'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { DEFAULT_THEME } from '@/lib/menu-types'
import type { MenuData, Quote, Settings } from '@/lib/menu-types'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

const toLatinDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

const safeUrl = (u: string) => u.replace(/"/g, '%22')

function safeHttpUrl(u: string | null | undefined) {
  const v = (u ?? '').trim()
  return /^https?:\/\//i.test(v) ? v : null
}

function cleanFamily(f: string | null | undefined) {
  if (!f) return ''
  return f.split(',')[0].replace(/["']/g, '').trim()
}

function getFormatFromUrl(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
  if (ext === 'woff2') return 'woff2'
  if (ext === 'woff') return 'woff'
  if (ext === 'otf') return 'opentype'
  return 'truetype'
}

function parseInstagram(v: string | null | undefined) {
  const raw = (v ?? '').trim()
  if (!raw) return null
  const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
  const handle = (m ? m[1] : raw.replace(/^@/, '')).replace(/[^A-Za-z0-9._]/g, '')
  return handle ? { handle, url: `https://instagram.com/${handle}` } : null
}

type ContactKey = 'address' | 'phone' | 'instagram' | 'hours'
type ContactItem = { text: string; href: string | null }
type IconName = ContactKey | 'close' | 'chat'

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  address: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  instagram: (
    <>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </>
  ),
  hours: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

const CHIP_EMOJI: Record<ContactKey, string> = {
  address: '📍',
  phone: '📞',
  instagram: '📷',
  hours: '🕐',
}

const extProps = (href: string) =>
  href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}

export default function CategoriesGrid({ initial }: { initial: MenuData }) {
  const { categories, products, quotes } = initial
  const theme = { ...DEFAULT_THEME, ...(initial.theme ?? {}) }
  const settings: Settings = initial.settings ?? {}

  const show = {
    quote: settings.show_quote !== false,
    shareButton: settings.show_share_button !== false,
    footer: settings.show_footer !== false,
    address: settings.show_address !== false,
    phone: settings.show_phone !== false,
    instagram: settings.show_instagram !== false,
    workingHours: settings.show_working_hours !== false,
  }

  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [tableParam, setTableParam] = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const table = params.get('table')
      if (table && /^\d+$/.test(table)) {
        setTableParam(table)
        sessionStorage.setItem('cafe-park-table', table)
      } else {
        const saved = sessionStorage.getItem('cafe-park-table')
        if (saved) setTableParam(saved)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (quotes.length > 0) {
      setCurrentQuote(quotes[Math.floor(Math.random() * quotes.length)])
    }
  }, [quotes])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!fabOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFabOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fabOpen])

  const family = cleanFamily(theme.font_family)

  const fontFaces = useMemo(() => {
    if (!family) return ''
    const faces: string[] = []
    const meta = Array.isArray(theme.font_metadata) ? theme.font_metadata : []
    const normalizedFamily = family.toLowerCase()

    for (const font of meta) {
      if (!font.url) continue
      const ff = (font.family ?? '').toLowerCase().trim()
      const related =
        ff === normalizedFamily || ff.startsWith(normalizedFamily + ' ')
      if (!related) continue
      const weight =
        font.weight ?? font.detected_weight ?? font.default_weight ?? 400
      faces.push(
        `@font-face{font-family:"${family}";src:url("${safeUrl(font.url)}") format("${getFormatFromUrl(font.url)}");font-weight:${weight};font-style:normal;font-display:swap;}`
      )
    }
    return faces.join('\n')
  }, [theme, family])

  const visibleCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products]
  )

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of products) {
      if (!p.category_id) continue
      map[p.category_id] = (map[p.category_id] || 0) + 1
    }
    return map
  }, [products])

  const featuredCount = useMemo(
    () => products.filter((p) => p.is_featured).length,
    [products]
  )

  const hasFeatured = featuredCount > 0

  const cafeName = settings.cafe_name || 'کافه پارک'
  const heroTitle = settings.hero_title || cafeName
  const heroSubtitle =
    settings.hero_subtitle ||
    settings.tagline ||
    'پارک سلامت شیراز · قهوه، نوشیدنی و غذا'
  const footerText = settings.footer_text || `${cafeName} · پارک سلامت شیراز`

  const addressText = show.address ? (settings.address ?? '').trim() : ''
  const phoneText = show.phone ? (settings.phone ?? '').trim() : ''
  const hoursText = show.workingHours ? (settings.working_hours ?? '').trim() : ''
  const ig = show.instagram ? parseInstagram(settings.instagram) : null
  const mapsUrl = safeHttpUrl(settings.maps_url)

  const contacts: Record<ContactKey, ContactItem | null> = {
    address: addressText ? { text: addressText, href: mapsUrl } : null,
    phone: phoneText
      ? {
          text: phoneText,
          href: `tel:${toLatinDigits(phoneText).replace(/[^\d+]/g, '')}`,
        }
      : null,
    instagram: ig ? { text: `@${ig.handle}`, href: ig.url } : null,
    hours: hoursText ? { text: hoursText, href: null } : null,
  }

  const inHeader: Record<ContactKey, boolean> = {
    address: settings.address_in_header !== false,
    phone: settings.phone_in_header !== false,
    instagram: settings.instagram_in_header !== false,
    hours: settings.hours_in_header !== false,
  }
  const inFooter: Record<ContactKey, boolean> = {
    address: settings.address_in_footer !== false,
    phone: settings.phone_in_footer !== false,
    instagram: settings.instagram_in_footer !== false,
    hours: settings.hours_in_footer !== false,
  }
  const inFloating = {
    address: settings.address_in_floating === true,
    phone: settings.phone_in_floating === true,
    instagram: settings.instagram_in_floating === true,
  }

  const ALL_KEYS: ContactKey[] = ['address', 'phone', 'instagram', 'hours']
  const headerKeys = ALL_KEYS.filter((k) => contacts[k] && inHeader[k])
  const footerKeys = ALL_KEYS.filter((k) => contacts[k] && inFooter[k])
  const floatKeys = (['phone', 'address', 'instagram'] as const).filter(
    (k) => contacts[k] && inFloating[k]
  )

  const headerStyle = settings.contact_header_style === 'text' ? 'text' : 'icons'
  const showFab = settings.floating_enabled === true && floatKeys.length > 0
  const fabSide = settings.floating_side === 'left' ? 'left' : 'right'

  const heroImage =
    settings.hero_bg_mode === 'image'
      ? safeHttpUrl(settings.hero_bg_image_url)
      : null
  const heroOverlay = Math.min(80, Math.max(0, settings.hero_overlay ?? 45))

  const handleShare = async () => {
    const shareData = {
      title: cafeName,
      text: settings.tagline || `منوی آنلاین ${cafeName}`,
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setToast('لینک منو کپی شد')
      }
    } catch {}
  }

  function buildSearchUrl(q: string) {
    const params = new URLSearchParams()
    if (tableParam) params.set('table', tableParam)
    if (q) params.set('q', q)
    return `/c/all?${params.toString()}`
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchInput.trim()
    if (!q) {
      window.location.href = buildSearchUrl('')
      return
    }
    window.location.href = buildSearchUrl(q)
  }

  const tableSuffix = tableParam ? `?table=${tableParam}` : ''

  const themeStyle = {
    '--primary-color': theme.primary_color,
    '--secondary-color': theme.secondary_color,
    '--background-color': theme.background_color,
    '--surface-color': theme.surface_color,
    '--text-color': theme.text_color,
    '--muted-text-color': theme.muted_text_color,
    '--accent-color': theme.accent_color,
    '--border-radius': `${theme.border_radius}px`,
    ...(fontFaces ? { '--font-family': `"${family}"` } : {}),
  } as React.CSSProperties

  return (
    <>
      {fontFaces && <style dangerouslySetInnerHTML={{ __html: fontFaces }} />}

      <div className="theme-root" style={themeStyle}>
        <header className={`hero ${heroImage ? 'hero-has-image' : ''}`}>
          {heroImage && (
            <Image
              className="hero-img"
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
            />
          )}
          <div
            className="hero-bg"
            aria-hidden="true"
            style={
              heroImage
                ? {
                    backgroundImage: `linear-gradient(rgba(41,37,31,${
                      heroOverlay / 100
                    }), rgba(41,37,31,${Math.min(
                      0.9,
                      heroOverlay / 100 + 0.15
                    )}))`,
                  }
                : undefined
            }
          />
          <div className="hero-content">
            {settings.logo_url && (
              <Image
                className="hero-logo"
                src={settings.logo_url}
                alt={cafeName}
                width={72}
                height={72}
                priority
              />
            )}
            <h1 className="brand">{heroTitle}</h1>
            <div className="sub">{heroSubtitle}</div>

            {headerKeys.length > 0 && (
              <div className="hero-info">
                {headerKeys.map((k) => {
                  const c = contacts[k]!
                  const asIcon =
                    headerStyle === 'icons' && k !== 'hours' && !!c.href

                  if (asIcon) {
                    const label =
                      k === 'phone'
                        ? `تماس با ${c.text}`
                        : k === 'address'
                          ? 'مسیریابی در نقشه'
                          : 'اینستاگرام'
                    return (
                      <a
                        key={k}
                        className="hero-icon"
                        href={c.href!}
                        aria-label={label}
                        title={label}
                        {...extProps(c.href!)}
                      >
                        <Icon name={k} />
                      </a>
                    )
                  }

                  const chip = `${CHIP_EMOJI[k]} ${c.text}`
                  return c.href ? (
                    <a
                      key={k}
                      href={c.href}
                      dir={k === 'address' ? undefined : 'ltr'}
                      {...extProps(c.href)}
                    >
                      {chip}
                    </a>
                  ) : (
                    <span key={k}>{chip}</span>
                  )
                })}
              </div>
            )}

            <div className="hero-actions">
              {show.shareButton && (
                <button
                  type="button"
                  className="share-btn"
                  onClick={handleShare}
                >
                  اشتراک‌گذاری منو
                </button>
              )}
              <Link href="/my-orders" className="share-btn hero-my-orders-btn">
                👤 سفارش‌های من
              </Link>
            </div>
          </div>
        </header>

        {show.quote && currentQuote && (
          <div className="quote-bar">
            <span className="quote-icon" aria-hidden="true">
              ❝
            </span>
            <span className="quote-text">{currentQuote.text}</span>
            {currentQuote.author && (
              <span className="quote-author">— {currentQuote.author}</span>
            )}
          </div>
        )}

        <div className="cat-grid-wrap">
          <form onSubmit={handleSearchSubmit} className="cat-search-form">
            <div className="search-box">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                aria-label="جستجو در منو"
                placeholder="جستجوی نوشیدنی، غذا..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </form>

          <div className="cat-grid">
            {hasFeatured && (
              <Link
                href={`/c/featured${tableSuffix}`}
                className="cat-card cat-card-featured"
              >
                <span className="cat-card-icon">⭐</span>
                <span className="cat-card-name">پیشنهاد کافه</span>
                <span className="cat-card-count">
                  {formatPrice(featuredCount)} آیتم
                </span>
              </Link>
            )}

            {visibleCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/c/${cat.id}${tableSuffix}`}
                className="cat-card"
              >
                <span className="cat-card-icon">{cat.icon || '🍽️'}</span>
                <span className="cat-card-name">{cat.name}</span>
                <span className="cat-card-count">
                  {formatPrice(countByCategory[cat.id] || 0)} آیتم
                </span>
              </Link>
            ))}
          </div>

          {visibleCategories.length === 0 && !hasFeatured && (
            <div className="empty">
              هنوز محصولی به منو اضافه نشده است.
            </div>
          )}
        </div>

        {(show.footer || footerKeys.length > 0) && (
          <footer>
            {footerKeys.length > 0 && (
              <ul className="footer-contact">
                {footerKeys.map((k) => {
                  const c = contacts[k]!
                  const inner = (
                    <>
                      <Icon name={k} />
                      <span
                        dir={
                          k === 'phone' || k === 'instagram' ? 'ltr' : undefined
                        }
                      >
                        {c.text}
                      </span>
                    </>
                  )
                  return (
                    <li key={k}>
                      {c.href ? (
                        <a href={c.href} {...extProps(c.href)}>
                          {inner}
                        </a>
                      ) : (
                        <span className="fc">{inner}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {show.footer && <div>{footerText}</div>}
          </footer>
        )}

        {showFab && (
          <>
            {fabOpen && (
              <div className="fab-backdrop" onClick={() => setFabOpen(false)} />
            )}
            <div className={`fab fab-${fabSide}`}>
              {fabOpen && (
                <div className="fab-panel">
                  {floatKeys.map((k) => {
                    const c = contacts[k]!
                    const text = k === 'address' && c.href ? 'مسیریابی' : c.text
                    const inner = (
                      <>
                        <Icon name={k} />
                        <span
                          dir={
                            k === 'phone' || k === 'instagram'
                              ? 'ltr'
                              : undefined
                          }
                        >
                          {text}
                        </span>
                      </>
                    )
                    return c.href ? (
                      <a
                        key={k}
                        className="fab-item"
                        href={c.href}
                        {...extProps(c.href)}
                        onClick={() => setFabOpen(false)}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={k} className="fab-item static">
                        {inner}
                      </div>
                    )
                  })}
                </div>
              )}
              <button
                type="button"
                className="fab-btn"
                aria-expanded={fabOpen}
                aria-label={fabOpen ? 'بستن' : 'تماس با ما'}
                onClick={() => setFabOpen((v) => !v)}
              >
                <Icon name={fabOpen ? 'close' : 'chat'} />
              </button>
            </div>
          </>
        )}

        {toast && (
          <div className="toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </div>
    </>
  )
}