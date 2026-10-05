'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'

type Category = {
  id: string
  name: string
  sort_order: number
}

type Product = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  size: string | null
  image_url: string | null
  is_featured: boolean
  sort_order: number
}

type FontFile = {
  url: string
  family?: string
  weight?: number
  detected_weight?: number
  default_weight?: number
  name?: string
}

type Theme = {
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

type Settings = {
  cafe_name?: string
  tagline?: string
  hero_title?: string
  hero_subtitle?: string
  footer_text?: string
  address?: string
  phone?: string
  instagram?: string
  working_hours?: string
}

type Quote = {
  id: string
  text: string
  author: string | null
}

const DEFAULT_THEME: Theme = {
  primary_color: '#6b4f3a',
  secondary_color: '#f3eee7',
  background_color: '#fffdf9',
  surface_color: '#ffffff',
  text_color: '#29251f',
  muted_text_color: '#766f64',
  accent_color: '#9a6b3f',
  font_family: 'Vazirmatn, Tahoma, Arial, sans-serif',
  font_url: null,
  font_regular_url: null,
  font_medium_url: null,
  font_semibold_url: null,
  font_bold_url: null,
  font_extrabold_url: null,
  font_black_url: null,
  font_metadata: null,
  border_radius: 10,
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [settings, setSettings] = useState<Settings>({})
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyFeatured, setOnlyFeatured] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // بارگذاری داده‌ها از API
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/menu', { cache: 'no-store' })
        if (!res.ok) throw new Error('خطا در دریافت منو')
        const data = await res.json()

        if (cancelled) return
        setCategories(data.categories ?? [])
        setProducts(data.products ?? [])
        if (data.theme) setTheme({ ...DEFAULT_THEME, ...data.theme })
        if (data.settings) setSettings(data.settings)

        const allQuotes: Quote[] = data.quotes ?? []
        setQuotes(allQuotes)
        if (allQuotes.length > 0) {
          const random =
            allQuotes[Math.floor(Math.random() * allQuotes.length)]
          setCurrentQuote(random)
        }
      } catch {
        if (!cancelled)
          setError('متأسفانه منو بارگذاری نشد. دوباره تلاش کن.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // ✅ ساخت @font-face برای همه وزن‌ها
  const fontFaces = useMemo(() => {
    const family = theme.font_family?.trim()
    if (!family) return ''

    const faces: string[] = []

    // از font_metadata اگه موجوده
    if (Array.isArray(theme.font_metadata) && theme.font_metadata.length > 0) {
  const normalizedFamily = family.toLowerCase().trim()

  for (const font of theme.font_metadata) {
    if (!font.url) continue

    // چک کن آیا این فونت به خانواده انتخاب‌شده مربوطه
    const fontFamily = (font.family ?? '').toLowerCase().trim()
    const isRelated =
      fontFamily === normalizedFamily ||
      fontFamily.startsWith(normalizedFamily + ' ')

    if (!isRelated) continue

    const weight = font.weight ?? font.detected_weight ?? font.default_weight ?? 400
    faces.push(`
      @font-face {
        font-family: "${family}";
        src: url("${font.url}") format("${getFormatFromUrl(font.url)}");
        font-weight: ${weight};
        font-style: normal;
        font-display: swap;
      }
    `)
  }
}

    // fallback: از ستون‌های جداگانه
    const weights: Array<{ w: number; url: string | null }> = [
      { w: 400, url: theme.font_regular_url },
      { w: 500, url: theme.font_medium_url },
      { w: 600, url: theme.font_semibold_url },
      { w: 700, url: theme.font_bold_url },
      { w: 800, url: theme.font_extrabold_url },
      { w: 900, url: theme.font_black_url },
    ]

    for (const { w, url } of weights) {
      if (!url) continue
      // اگه توی metadata بود، دوباره اضافه نکن
      if (
        Array.isArray(theme.font_metadata) &&
        theme.font_metadata.some((f) => f.url === url)
      )
        continue

      faces.push(`
        @font-face {
          font-family: "${family}";
          src: url("${url}") format("${getFormatFromUrl(url)}");
          font-weight: ${w};
          font-style: normal;
          font-display: swap;
        }
      `)
    }

    return faces.join('\n')
  }, [theme])

  const fontFamily = theme.font_family?.trim() || 'Vazirmatn, Tahoma, Arial, sans-serif'
// 🐛 Debug (بعداً حذف کن)


  // فیلتر محصولات
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (onlyFeatured && !p.is_featured) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [products, search, onlyFeatured])

  const grouped = useMemo(() => {
    return categories
      .map((c) => ({
        category: c,
        items: filtered.filter((p) => p.category_id === c.id),
      }))
      .filter((g) => g.items.length > 0)
  }, [categories, filtered])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id.replace('c-', ''))
          }
        })
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    )

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [grouped])

  const themeStyle = {
    '--primary-color': theme.primary_color,
    '--secondary-color': theme.secondary_color,
    '--background-color': theme.background_color,
    '--surface-color': theme.surface_color,
    '--text-color': theme.text_color,
    '--muted-text-color': theme.muted_text_color,
    '--accent-color': theme.accent_color,
    '--border-radius': `${theme.border_radius}px`,
    '--font-family': fontFamily,
  } as React.CSSProperties

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fa-IR').format(price)

  const handleShare = async () => {
    const shareData = {
      title: settings.cafe_name || 'منوی کافه پارک',
      text: settings.tagline || 'منوی آنلاین کافه پارک',
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        alert('لینک منو کپی شد ✅')
      }
    } catch {
      // کاربر انصراف داد
    }
  }

  const scrollToCategory = (id: string) => {
    const el = sectionRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cafeName = settings.cafe_name || 'کافه پارک'
  const heroTitle = settings.hero_title || cafeName
  const heroSubtitle =
    settings.hero_subtitle ||
    settings.tagline ||
    'پارک سلامت شیراز · قهوه، نوشیدنی و غذا'
  const footerText = settings.footer_text || `${cafeName} · پارک سلامت شیراز`

  return (
    <>
      {/* ✅ فونت‌ها اینجا لود می‌شن */}
      {fontFaces && <style dangerouslySetInnerHTML={{ __html: fontFaces }} />}

      <div className="theme-root" style={themeStyle}>
        <header className="hero">
          <div className="hero-bg" aria-hidden="true" />
          <div className="hero-content">
            <div className="brand">{heroTitle}</div>
            <div className="sub">{heroSubtitle}</div>

            {(settings.address ||
              settings.phone ||
              settings.working_hours) && (
              <div className="hero-info">
                {settings.address && <span>📍 {settings.address}</span>}
                {settings.phone && (
                  <span dir="ltr">📞 {settings.phone}</span>
                )}
                {settings.working_hours && (
                  <span>🕐 {settings.working_hours}</span>
                )}
              </div>
            )}

            <div className="hero-actions">
              <button className="share-btn" onClick={handleShare}>
                اشتراک‌گذاری منو
              </button>
            </div>
          </div>
        </header>

        {currentQuote && (
          <div className="quote-bar">
            <span className="quote-icon">❝</span>
            <span className="quote-text">{currentQuote.text}</span>
            {currentQuote.author && (
              <span className="quote-author">
                — {currentQuote.author}
              </span>
            )}
          </div>
        )}

        <div className="toolbar">
          <div className="search-box">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="جستجوی نوشیدنی، غذا..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`filter-chip ${onlyFeatured ? 'active' : ''}`}
            onClick={() => setOnlyFeatured((v) => !v)}
          >
            ⭐ پیشنهاد کافه
          </button>
        </div>

        {categories.length > 0 && (
          <nav className="cats">
            {grouped.map(({ category }) => (
              <button
                key={category.id}
                className={`cat ${
                  activeCategory === category.id ? 'active' : ''
                }`}
                onClick={() => scrollToCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </nav>
        )}

        <main className="wrap">
          {loading ? (
            <div className="skeleton-list">
              {[...Array(4)].map((_, i) => (
                <div className="skeleton-card" key={i}>
                  <div className="skeleton-line w-60" />
                  <div className="skeleton-line w-40" />
                  <div className="skeleton-box" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="empty">{error}</div>
          ) : grouped.length === 0 ? (
            <div className="empty">محصولی برای نمایش پیدا نشد.</div>
          ) : (
            grouped.map(({ category, items }) => (
              <section
                key={category.id}
                id={`c-${category.id}`}
                className="section"
                ref={(el) => {
                  sectionRefs.current[category.id] = el
                }}
              >
                <h2>
                  {category.name}
                  <span className="count">{items.length}</span>
                </h2>

                <div className="grid">
                  {items.map((product, index) => (
                    <article
                      className="product"
                      key={product.id}
                      style={{
                        animationDelay: `${Math.min(
                          index * 40,
                          400
                        )}ms`,
                      }}
                    >
                      <div className="photo">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={200}
                            height={200}
                            sizes="(max-width: 520px) 100vw, 320px"
                          />
                        ) : (
                          <span>عکس محصول</span>
                        )}
                        {product.is_featured && (
                          <span className="featured-badge">
                            ⭐ پیشنهاد
                          </span>
                        )}
                      </div>

                      <div className="product-info">
                        <div className="name">{product.name}</div>

                        {product.description && (
                          <div className="desc">
                            {product.description}
                          </div>
                        )}

                        <div className="meta">
                          {product.size && (
                            <span className="size">{product.size}</span>
                          )}
                          <span className="price">
                            {formatPrice(product.price)}{' '}
                            <small>تومان</small>
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
      </div>
    </>
  )
}

// ✅ تشخیص فرمت فایل از URL
function getFormatFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase() || ''
  if (ext === 'woff2') return 'woff2'
  if (ext === 'woff') return 'woff'
  if (ext === 'otf') return 'opentype'
  if (ext === 'ttf') return 'truetype'
  return 'truetype'
}
