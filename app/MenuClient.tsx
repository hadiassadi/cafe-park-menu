'use client'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { DEFAULT_THEME } from '@/lib/menu-types'
import type { MenuData, Quote, Settings } from '@/lib/menu-types'
import ProductDetailModal from './components/ProductDetailModal'
import type { Product } from '@/lib/menu-types'
import { useCart } from '@/lib/cart-context'
import ServiceWorkerRegister from './components/ServiceWorkerRegister'
import PWAInstallPrompt from './components/PWAInstallPrompt'

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, ' ')
    .trim()
}

function getFormatFromUrl(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
  if (ext === 'woff2') return 'woff2'
  if (ext === 'woff') return 'woff'
  if (ext === 'otf') return 'opentype'
  return 'truetype'
}

function cleanFamily(f: string | null | undefined) {
  if (!f) return ''
  return f.split(',')[0].replace(/["']/g, '').trim()
}

const safeUrl = (u: string) => u.replace(/"/g, '%22')
function getMinPrice(product: Product): number {
  const groups = product.variant_groups ?? []
  if (groups.length === 0) return product.price

  let min = Infinity
  for (const g of groups) {
    for (const o of g.variant_options) {
      if (!o.is_available) continue
      const p = o.price_modifier
      if (p < min) min = p
    }
  }
  return min === Infinity ? product.price : min
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

const toFaDigits = (s: string) =>
  s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

const toLatinDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

function safeHttpUrl(u: string | null | undefined) {
  const v = (u ?? '').trim()
  return /^https?:\/\//i.test(v) ? v : null
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

export default function MenuClient({
  initial,
  initialCategoryId = null,
}: {
  initial: MenuData
  initialCategoryId?: string | null
}) {
  const { categories, products, quotes } = initial
  const theme = { ...DEFAULT_THEME, ...(initial.theme ?? {}) }
  const settings: Settings = initial.settings ?? {}

  const isAllMode = initialCategoryId === 'all'
  const isFeaturedMode = initialCategoryId === 'featured'

  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const show = {
    quote: settings.show_quote !== false,
    shareButton: settings.show_share_button !== false,
    featuredFilter: settings.show_featured_filter !== false,
    productImages: settings.show_product_images !== false,
    productSize: settings.show_product_size !== false,
    footer: settings.show_footer !== false,
    address: settings.show_address !== false,
    phone: settings.show_phone !== false,
    instagram: settings.show_instagram !== false,
    workingHours: settings.show_working_hours !== false,
  }

  const [search, setSearch] = useState(initialQuery)
  const deferredSearch = useDeferredValue(search)
  const [onlyFeatured, setOnlyFeatured] = useState(false)
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [tableParam, setTableParam] = useState('')
  const { totalItems, totalPrice } = useCart()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const tableFromUrl = params.get('table')
      if (tableFromUrl && /^\d+$/.test(tableFromUrl)) {
        setTableParam(tableFromUrl)
        sessionStorage.setItem('cafe-park-table', tableFromUrl)
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

    const weights: Array<{ w: number; url: string | null }> = [
      { w: 400, url: theme.font_regular_url },
      { w: 500, url: theme.font_medium_url },
      { w: 600, url: theme.font_semibold_url },
      { w: 700, url: theme.font_bold_url },
      { w: 800, url: theme.font_extrabold_url },
      { w: 900, url: theme.font_black_url },
    ]
    for (const { w, url } of weights) {
      if (!url || meta.some((f) => f.url === url)) continue
      faces.push(
        `@font-face{font-family:"${family}";src:url("${safeUrl(url)}") format("${getFormatFromUrl(url)}");font-weight:${w};font-style:normal;font-display:swap;}`
      )
    }
    return faces.join('\n')
  }, [theme, family])

  const hasFeatured = useMemo(
    () => products.some((p) => p.is_featured),
    [products]
  )

  const searchIndex = useMemo(
    () =>
      new Map(
        products.map((p) => [
          p.id,
          normalize(`${p.name} ${p.description ?? ''}`),
        ])
      ),
    [products]
  )

  const currentCategory = useMemo(
    () =>
      initialCategoryId && !isAllMode && !isFeaturedMode
        ? categories.find((c) => c.id === initialCategoryId) || null
        : null,
    [categories, initialCategoryId, isAllMode, isFeaturedMode]
  )

  const pageTitle = isFeaturedMode
    ? '⭐ پیشنهاد کافه'
    : isAllMode
      ? search
        ? `نتایج جستجو: ${search}`
        : 'همه محصولات'
      : currentCategory?.name || 'منو'

  const displayedProducts = useMemo(() => {
    let result = products

    if (isFeaturedMode) {
      result = result.filter((p) => p.is_featured)
    } else if (!isAllMode && initialCategoryId) {
      result = result.filter((p) => p.category_id === initialCategoryId)
    }

    const q = normalize(deferredSearch)
    if (q) {
      result = result.filter((p) => (searchIndex.get(p.id) ?? '').includes(q))
    }

    if (onlyFeatured && !isFeaturedMode) {
      result = result.filter((p) => p.is_featured)
    }

    return result
  }, [
    products,
    initialCategoryId,
    isAllMode,
    isFeaturedMode,
    deferredSearch,
    searchIndex,
    onlyFeatured,
  ])

  const navCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products]
  )

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
  const pageBg =
    settings.bg_enabled === true ? safeHttpUrl(settings.bg_image_url) : null
  const bgWash = Math.min(98, Math.max(0, settings.bg_overlay ?? 88))

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

      <div className={`theme-root ${pageBg ? 'has-page-bg' : ''}`} style={themeStyle}>
        {pageBg && (
          <div
            className="page-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url("${safeUrl(pageBg)}")` }}
          >
            <div className="page-bg-wash" style={{ opacity: bgWash / 100 }} />
          </div>
        )}
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

        <div className="sticky-head">
          <div className="cat-page-header">
            <Link href={`/${tableSuffix}`} className="cat-page-back">
              ← همه دسته‌ها
            </Link>
            <h1 className="cat-page-title">{pageTitle}</h1>
            <span className="cat-page-spacer" aria-hidden="true" />
          </div>

          <div className="toolbar">
            <div className="search-box">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                aria-label="جستجو در منو"
                placeholder="جستجو در این بخش..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {hasFeatured && show.featuredFilter && !isFeaturedMode && (
              <button
                type="button"
                className={`filter-chip ${onlyFeatured ? 'active' : ''}`}
                aria-pressed={onlyFeatured}
                onClick={() => setOnlyFeatured((v) => !v)}
              >
                ⭐ پیشنهاد
              </button>
            )}
          </div>

          <nav className="cats" aria-label="دسته‌بندی‌ها">
            {hasFeatured && (
              <Link
                href={`/c/featured${tableSuffix}`}
                className={`cat ${isFeaturedMode ? 'active' : ''}`}
              >
                <span className="cat-icon">⭐</span>
                پیشنهاد کافه
              </Link>
            )}
            {navCategories.map((category) => (
              <Link
                key={category.id}
                href={`/c/${category.id}${tableSuffix}`}
                className={`cat ${
                  initialCategoryId === category.id ? 'active' : ''
                }`}
              >
                {category.icon && (
                  <span className="cat-icon">{category.icon}</span>
                )}
                {category.name}
              </Link>
            ))}
          </nav>
        </div>

        <main className="wrap">
          {displayedProducts.length === 0 ? (
            <div className="empty">
              {search || onlyFeatured
                ? 'موردی پیدا نشد. عبارت دیگری را جستجو کن یا فیلتر را بردار.'
                : 'هنوز محصولی در این دسته وجود ندارد.'}
            </div>
          ) : (
            <div className="grid">
              {displayedProducts.map((product, index) => {
                const hasVariants = (product.variant_groups ?? []).length > 0

                return (
                  <article
                    className="product product-clickable"
                    key={product.id}
                    style={{
                      animationDelay: `${Math.min(index * 40, 400)}ms`,
                    }}
                    onClick={() => setSelectedProduct(product)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedProduct(product)
                      }
                    }}
                  >
                    {show.productImages && product.image_url && (
                      <div className="photo">
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          width={256}
                          height={256}
                          sizes="(max-width: 640px) 112px, 128px"
                          priority={index < 2}
                        />
                        {product.is_featured && (
                          <span className="featured-badge">⭐ پیشنهاد</span>
                        )}
                        {product.is_new && (
                          <span className="new-badge">🆕 جدید</span>
                        )}
                        {product.is_available === false && (
                          <span className="unavailable-badge">ناموجود</span>
                        )}
                      </div>
                    )}

                    <div className="product-info">
                      <div className="name">
                        {product.name}
                        {!(show.productImages && product.image_url) &&
                          product.is_featured && (
                            <span className="featured-inline">⭐</span>
                          )}
                        {!(show.productImages && product.image_url) &&
                          product.is_new && (
                            <span className="new-inline">🆕</span>
                          )}
                      </div>

                      {product.description && (
                        <div className="desc">{product.description}</div>
                      )}

                      <div className="meta">
                        {show.productSize && product.size && (
                          <span className="size">
                            {toFaDigits(product.size)}
                          </span>
                        )}

                        {hasVariants ? (
                          <span className="price price-from">
                            از {formatPrice(getMinPrice(product))}{' '}
                            <small>تومان</small>
                          </span>
                        ) : (
                          <span className="price">
                            {formatPrice(product.price)}{' '}
                            <small>تومان</small>
                          </span>
                        )}
                      </div>

                      <div className="product-action-hint">
                        {hasVariants
                          ? '👆 مشاهده گزینه‌ها'
                          : '👆 اطلاعات بیشتر'}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </main>

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
                          k === 'phone' || k === 'instagram'
                            ? 'ltr'
                            : undefined
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
              <div
                className="fab-backdrop"
                onClick={() => setFabOpen(false)}
              />
            )}
            <div className={`fab fab-${fabSide}`}>
              {fabOpen && (
                <div className="fab-panel">
                  {floatKeys.map((k) => {
                    const c = contacts[k]!
                    const text =
                      k === 'address' && c.href ? 'مسیریابی' : c.text
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

        <ProductDetailModal
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
        {totalItems > 0 && (
          <Link
            href={`/cart${tableSuffix}`}
            className="cart-floating-bar"
            aria-label="مشاهده سبد خرید"
          >
            <span className="cart-floating-icon">🛒</span>
            <span className="cart-floating-text">
              <span className="cart-floating-count">
                {formatPrice(totalItems)} قلم
              </span>
              <span className="cart-floating-total">
                {formatPrice(totalPrice)} <small>تومان</small>
              </span>
            </span>
            <span className="cart-floating-arrow">←</span>
          </Link>
        )}
        <ServiceWorkerRegister />
        <PWAInstallPrompt />

        {toast && (
          <div className="toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </div>
    </>
  )
}