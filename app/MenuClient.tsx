'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { DEFAULT_THEME } from '@/lib/menu-types'
import type { MenuData, Quote } from '@/lib/menu-types'

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

/* ---------- کامپوننت ---------- */

export default function MenuClient({ initial }: { initial: MenuData }) {
  const { categories, products, quotes } = initial
  const theme = { ...DEFAULT_THEME, ...(initial.theme ?? {}) }
  const settings = initial.settings ?? {}

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [onlyFeatured, setOnlyFeatured] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

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

  // تعداد کل محصولات هر دسته (بدون در نظر گرفتن فیلتر) برای بخش «کل منو»
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1)
    return m
  }, [products])

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

  // «کل منو»: بستن با Esc و قفل اسکرول پس‌زمینه
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
    }
  }, [menuOpen])

  const pickFromAllMenu = (id: string) => {
    setMenuOpen(false)
    // کمی صبر تا قفل اسکرول برداشته شود، بعد اسکرول
    setTimeout(() => scrollToCategory(id), 60)
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

      <div className="theme-root" style={themeStyle}>
        <header className="hero">
          <div className="hero-bg" aria-hidden="true" />
          <div className="hero-content">
            <h1 className="brand">{heroTitle}</h1>
            <div className="sub">{heroSubtitle}</div>

            {(settings.address || settings.phone || settings.working_hours) && (
              <div className="hero-info">
                {settings.address && <span>📍 {settings.address}</span>}
                {settings.phone && <span dir="ltr">📞 {settings.phone}</span>}
                {settings.working_hours && <span>🕐 {settings.working_hours}</span>}
              </div>
            )}

            <div className="hero-actions">
              <button type="button" className="share-btn" onClick={handleShare}>
                اشتراک‌گذاری منو
              </button>
            </div>
          </div>
        </header>

        {currentQuote && (
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
            {hasFeatured && (
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
                aria-haspopup="dialog"
                onClick={() => setMenuOpen(true)}
              >
                <span aria-hidden="true">☰</span> کل منو
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
                      {product.image_url && (
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
                          {!product.image_url && product.is_featured && (
                            <span className="featured-inline">⭐</span>
                          )}
                        </div>

                        {product.description && (
                          <div className="desc">{product.description}</div>
                        )}

                        <div className="meta">
                          {product.size && (
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

        <footer>{footerText}</footer>

        {menuOpen && (
          <div className="sheet-overlay" onClick={() => setMenuOpen(false)}>
            <div
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="کل منو"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-handle" aria-hidden="true" />
              <div className="sheet-head">
                <h2>کل منو</h2>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="بستن"
                  onClick={() => setMenuOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="sheet-grid">
                {navCategories.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`sheet-item ${currentActive === c.id ? 'active' : ''}`}
                    onClick={() => pickFromAllMenu(c.id)}
                  >
                    <span className="sheet-icon" aria-hidden="true">
                      {c.icon || '🍽️'}
                    </span>
                    <span className="sheet-name">{c.name}</span>
                    <span className="sheet-count">
                      {formatPrice(categoryCounts.get(c.id) ?? 0)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
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
