import { supabaseServer } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const db = await supabaseServer()

  const [
    categoriesRes,
    productsRes,
    quotesRes,
    themesRes,
    recentProductsRes,
  ] = await Promise.all([
    db
      .from('categories')
      .select('id', { count: 'exact', head: true }),

    db.from('products').select('id, is_active, is_featured'),

    db
      .from('quotes')
      .select('id', { count: 'exact', head: true }),

    db
      .from('themes')
      .select('id', { count: 'exact', head: true }),

    db
      .from('products')
      .select('id, name, price, image_url, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const products = productsRes.data ?? []
  const activeProducts = products.filter((p) => p.is_active).length
  const featuredProducts = products.filter((p) => p.is_featured).length

  const stats = [
    {
      label: 'دسته‌بندی‌ها',
      value: categoriesRes.count ?? 0,
      icon: '📂',
      href: '/admin/categories',
      color: '#6b4f3a',
    },
    {
      label: 'محصولات',
      value: products.length,
      icon: '☕',
      href: '/admin/products',
      color: '#9a6b3f',
    },
    {
      label: 'جملات',
      value: quotesRes.count ?? 0,
      icon: '💬',
      href: '/admin/quotes',
      color: '#477052',
    },
    {
      label: 'قالب‌ها',
      value: themesRes.count ?? 0,
      icon: '🎨',
      href: '/admin/themes',
      color: '#66523c',
    },
  ]

  const quickLinks = [
    {
      label: 'افزودن محصول',
      icon: '➕',
      href: '/admin/products',
      desc: 'محصول جدید به منو اضافه کن',
    },
    {
      label: 'ویرایش تنظیمات',
      icon: '⚙️',
      href: '/admin/settings',
      desc: 'نام، شعار، تماس',
    },
    {
      label: 'مدیریت جملات',
      icon: '💬',
      href: '/admin/quotes',
      desc: 'جمله روز کافه',
    },
    {
      label: 'ویرایش قالب',
      icon: '🎨',
      href: '/admin/themes',
      desc: 'رنگ و فونت منو',
    },
  ]

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fa-IR').format(price)

  return (
    <div className="dashboard">
      {/* خوش‌آمد */}
      <div className="dashboard-welcome">
        <div>
          <h1>سلام 👋</h1>
          <p>به پنل مدیریت کافه پارک خوش اومدی</p>
        </div>
      </div>

      {/* کارت‌های آمار */}
      <section className="dashboard-section">
        <h2>📊 آمار کلی</h2>

        <div className="stats-grid">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="stat-card"
            >
              <span
                className="stat-icon"
                style={{ background: `${stat.color}15` }}
              >
                {stat.icon}
              </span>

              <div className="stat-content">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* وضعیت محصولات */}
      <section className="dashboard-section">
        <h2>☕ وضعیت محصولات</h2>

        <div className="status-grid">
          <div className="status-card">
            <div className="status-card-icon active">✅</div>
            <div>
              <div className="status-card-value">{activeProducts}</div>
              <div className="status-card-label">محصول فعال</div>
            </div>
          </div>

          <div className="status-card">
            <div className="status-card-icon featured">⭐</div>
            <div>
              <div className="status-card-value">{featuredProducts}</div>
              <div className="status-card-label">پیشنهاد کافه</div>
            </div>
          </div>

          <div className="status-card">
            <div className="status-card-icon inactive">⭕</div>
            <div>
              <div className="status-card-value">
                {products.length - activeProducts}
              </div>
              <div className="status-card-label">غیرفعال</div>
            </div>
          </div>
        </div>
      </section>

      {/* دسترسی سریع */}
      <section className="dashboard-section">
        <h2>⚡ دسترسی سریع</h2>

        <div className="quick-links-grid">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="quick-link-card"
            >
              <span className="quick-link-icon">{link.icon}</span>
              <div>
                <strong>{link.label}</strong>
                <small>{link.desc}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* آخرین محصولات */}
      {recentProductsRes.data && recentProductsRes.data.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>🆕 آخرین محصولات</h2>
            <Link href="/admin/products" className="section-link">
              مشاهده همه ←
            </Link>
          </div>

          <div className="recent-products">
            {recentProductsRes.data.map((product) => (
              <div key={product.id} className="recent-product">
                <div className="recent-product-image">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      width={56}
                      height={56}
                    />
                  ) : (
                    <span>بدون عکس</span>
                  )}
                </div>

                <div className="recent-product-info">
                  <strong>{product.name}</strong>
                  <small>{formatPrice(product.price)} تومان</small>
                </div>

                <span
                  className={`recent-product-status ${
                    product.is_active ? 'active' : 'inactive'
                  }`}
                >
                  {product.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* مشاهده منو */}
      <div className="dashboard-footer-link">
        <Link href="/" target="_blank" className="btn primary-btn">
          🌐 مشاهده منوی عمومی
        </Link>
      </div>
    </div>
  )
}