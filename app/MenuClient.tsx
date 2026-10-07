'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { DEFAULT_THEME } from '@/lib/menu-types'
import type { MenuData, Quote, Settings } from '@/lib/menu-types'

/* ---------- کمکی‌ها ---------- */

// نرمال‌سازی متن فارسی برای جستجو: ي/ك عربی، ارقام، اعراب، نیم‌فاصله
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

// فقط اولین اسم از font-family (اگر کل stack ذخیره شده باشد)
function cleanFamily(f: string | null | undefined) {
  if (!f) return ''
  return f.split(',')[0].replace(/["']/g, '').trim()
}

const safeUrl = (u: string) => u.replace(/"/g, '%22')

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

// ارقام انگلیسی → فارسی (برای هماهنگی «اندازه» با قیمت)
const toFaDigits = (s: string) =>
  s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

// ارقام فارسی/عربی → انگلیسی (برای لینک تماس)
const toLatinDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))

// فقط آدرس‌های http/https
function safeHttpUrl(u: string | null | undefined) {
  const v = (u ?? '').trim()
  return /^https?:\/\//i.test(v) ? v : null
}

// «@name» یا لینک کامل اینستاگرام → { handle, url }
function parseInstagram(v: string | null | undefined) {
  const raw = (v ?? '').trim()
  if (!raw) return null
  const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
  const handle = (m ? m[1] : raw.replace(/^@/, '')).replace(/[^A-Za-z0-9._]/g, '')
  return handle ? { handle, url: `https://instagram.com/${handle}` } : null
}

/* ---------- آیکن‌ها و مدل اطلاعات تماس ---------- */

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

/* ---------- کامپوننت ---------- */

export default function MenuClient({ initial }: { initial: MenuData }) {
  const { categories, products, quotes } = initial
  const theme = { ...DEFAULT_THEME, ...(initial.theme ?? {}) }
  const settings: Settings = initial.settings ?? {}

  // کلیدهای «نمایش در منو» از تنظیمات (پیش‌فرض همه روشن)
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

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [onlyFeatured, setOnlyFeatured] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [fabOpen, setFabOpen] = useState(false)

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // انتخاب نقل‌قول بعد از mount (تا با HTML سرور اختلاف hydration ایجاد نشود)
  useEffect(() => {
    if (quotes.length > 0) {
      setCurrentQuote(quotes[Math.floor(Math.random() * quotes.length)])
    }
  }, [quotes])

  // toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  // دکمه شناور: بستن با Esc
  useEffect(() => {
    if (!fabOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFabOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fabOpen])

  /* ---------- فونت سفارشی (فقط اگر ادمین واقعاً فایل آپلود کرده) ---------- */

  const family = cleanFamily(theme.font_family)

  const fontFaces = useMemo(() => {
    if (!family) return ''
    const faces: string[] = []
    const meta = Array.isArray(theme.font_metadata) ? theme.font_metadata : []
    const normalizedFamily = family.toLowerCase()

    for (const font of meta) {
      if (!font.url) continue
      const ff = (font.family ?? '').toLowerCase().trim()
      const related = ff === normalizedFamily || ff.startsWith(normalizedFamily + ' ')
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

  /* ---------- فیلتر و گروه‌بندی ---------- */

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

  const filtered = useMemo(() => {
    const q = normalize(deferredSearch)
    return products.filter((p) => {
      if (onlyFeatured && !p.is_featured) return false
      if (!q) return true
      return (searchIndex.get(p.id) ?? '').includes(q)
    })
  }, [products, deferredSearch, onlyFeatured, searchIndex])

  const grouped = useMemo(
    () =>
      categories
        .map((c) => ({
          category: c,
          items: filtered.filter((p) => p.category_id === c.id),
        }))
        .filter((g) => g.items.length > 0),
    [categories, filtered]
  )

  // نوار دسته‌ها همیشه همه دسته‌های دارای محصول را نشان می‌دهد،
  // حتی وقتی فیلتر «پیشنهاد کافه» یا جستجو فعال است
  const navCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products]
  )

  const visibleIds = useMemo(
    () => new Set(grouped.map((g) => g.category.id)),
    [grouped]
  )


  /* ---------- هایلایت دسته فعال هنگام اسکرول ---------- */

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id.replace('c-', ''))
          }
        }
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    )
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [grouped])

  /* ---------- اکشن‌ها ---------- */

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

  // جای نمایش هر مورد (پیش‌فرض: هدر و فوتر روشن، شناور خاموش)
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

  // ظاهر هدر و پس‌زمینه صفحه
  const heroImage =
    settings.hero_bg_mode === 'image' ? safeHttpUrl(settings.hero_bg_image_url) : null
  const heroOverlay = Math.min(80, Math.max(0, settings.hero_overlay ?? 45))
  const pageBg = settings.bg_enabled === true ? safeHttpUrl(settings.bg_image_url) : null
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
    } catch {
      // کاربر انصراف داد
    }
  }

  const scrollToCategory = (id: string) => {
    if (!visibleIds.has(id)) {
      // دسته‌ای که با فیلتر فعلی مخفی است: فیلترها را بردار و بعد از رندر برو سراغش
      setOnlyFeatured(false)
      setSearch('')
      setPendingScroll(id)
      return
    }
    setActiveCategory(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // بعد از برداشتن فیلتر و رندر دوباره، به دسته انتخاب‌شده اسکرول کن
  useEffect(() => {
    if (!pendingScroll) return
    const el = sectionRefs.current[pendingScroll]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveCategory(pendingScroll)
      setPendingScroll(null)
    }
  }, [pendingScroll, grouped])

  // «کل منو»: برگشت به نمای اصلی (همه دسته‌ها، بدون فیلتر، از بالای صفحه)
  const showAllMenu = () => {
    setSearch('')
    setOnlyFeatured(false)
    setActiveCategory(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const themeStyle = {
    '--primary-color': theme.primary_color,
    '--secondary-color': theme.secondary_color,
    '--background-color': theme.background_color,
    '--surface-color': theme.surface_color,
    '--text-color': theme.text_color,
    '--muted-text-color': theme.muted_text_color,
    '--accent-color': theme.accent_color,
    '--border-radius': `${theme.border_radius}px`,
    // فقط وقتی فونت سفارشی واقعاً تعریف شده؛ در غیر این صورت وزیرمتن layout
    ...(fontFaces ? { '--font-family': `"${family}"` } : {}),
  } as React.CSSProperties

  const currentActive =
    activeCategory && visibleIds.has(activeCategory)
      ? activeCategory
      : grouped[0]?.category.id ?? null

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
                    }), rgba(41,37,31,${Math.min(0.9, heroOverlay / 100 + 0.15)}))`,
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
                  const asIcon = headerStyle === 'icons' && k !== 'hours' && !!c.href

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

            {show.shareButton && (
              <div className="hero-actions">
                <button type="button" className="share-btn" onClick={handleShare}>
                  اشتراک‌گذاری منو
                </button>
              </div>
            )}
          </div>
        </header>

        {show.quote && currentQuote && (
          <div className="quote-bar">
            <span className="quote-icon" aria-hidden="true">❝</span>
            <span className="quote-text">{currentQuote.text}</span>
            {currentQuote.author && (
              <span className="quote-author">— {currentQuote.author}</span>
            )}
          </div>
        )}

        {/* toolbar و دسته‌ها داخل یک wrapper sticky: بدون JS و بدون عدد جادویی */}
        <div className="sticky-head">
          <div className="toolbar">
            <div className="search-box">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                aria-label="جستجو در منو"
                placeholder="جستجوی نوشیدنی، غذا..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {hasFeatured && show.featuredFilter && (
              <button
                type="button"
                className={`filter-chip ${onlyFeatured ? 'active' : ''}`}
                aria-pressed={onlyFeatured}
                onClick={() => setOnlyFeatured((v) => !v)}
              >
                ⭐ پیشنهاد کافه
              </button>
            )}
          </div>

          {navCategories.length > 0 && (
            <nav className="cats" aria-label="دسته‌بندی‌ها">
              <button
                type="button"
                className="cat cat-all"
                onClick={showAllMenu}
              >
                <span aria-hidden="true">🍽️</span> کل منو
              </button>
              {navCategories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={`cat ${currentActive === category.id ? 'active' : ''} ${
                    visibleIds.has(category.id) ? '' : 'dim'
                  }`}
                  aria-current={currentActive === category.id ? 'true' : undefined}
                  onClick={() => scrollToCategory(category.id)}
                >
                  {category.icon && <span className="cat-icon">{category.icon}</span>}
                  {category.name}
                </button>
              ))}
            </nav>
          )}
        </div>

        <main className="wrap">
          {grouped.length === 0 ? (
            <div className="empty">
              {search || onlyFeatured
                ? 'موردی پیدا نشد. عبارت دیگری را جستجو کن یا فیلتر را بردار.'
                : 'هنوز محصولی به منو اضافه نشده است.'}
            </div>
          ) : (
            grouped.map(({ category, items }, groupIndex) => (
              <section
                key={category.id}
                id={`c-${category.id}`}
                className="section"
                ref={(el) => {
                  sectionRefs.current[category.id] = el
                }}
              >
                <h2>
                  {category.icon && <span className="section-icon">{category.icon}</span>}
                  {category.name}
                  <span className="count">{formatPrice(items.length)}</span>
                </h2>

                <div className="grid">
                  {items.map((product, index) => (
                    <article
                      className="product"
                      key={product.id}
                      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
                    >
                      {/* بدون عکس = بدون باکس خاکستری */}
                      {show.productImages && product.image_url && (
                        <div className="photo">
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={256}
                            height={256}
                            sizes="(max-width: 640px) 112px, 128px"
                            priority={groupIndex === 0 && index < 2}
                          />
                          {product.is_featured && (
                            <span className="featured-badge">⭐ پیشنهاد</span>
                          )}
                        </div>
                      )}

                      <div className="product-info">
                        <div className="name">
                          {product.name}
                          {!(show.productImages && product.image_url) && product.is_featured && (
                            <span className="featured-inline">⭐</span>
                          )}
                        </div>

                        {product.description && (
                          <div className="desc">{product.description}</div>
                        )}

                        <div className="meta">
                          {show.productSize && product.size && (
                            <span className="size">{toFaDigits(product.size)}</span>
                          )}
                          <span className="price">
                            {formatPrice(product.price)} <small>تومان</small>
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
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
                      <span dir={k === 'phone' || k === 'instagram' ? 'ltr' : undefined}>
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
                    const text =
                      k === 'address' && c.href ? 'مسیریابی' : c.text
                    const inner = (
                      <>
                        <Icon name={k} />
                        <span dir={k === 'phone' || k === 'instagram' ? 'ltr' : undefined}>
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
