'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import AdminThemeToggle from './components/AdminThemeToggle'
import NewOrderAlert from './components/NewOrderAlert'
import { useOrderNotifications } from '@/lib/use-order-notifications'
import { useDocumentTitle } from '@/lib/use-document-title'

// 🎯 پچ ۴۱ — منوی یکپارچه: یک منبع واحد برای سایدبار دسکتاپ و drawer موبایل
// ۲۲ آیتم قبلاً فهرست تختِ شلوغ بود؛ حالا ۶ گروه منطقی با برچسب — دسترسی به همه بخش‌ها از یک ساختار واحد
const MENU_GROUPS = [
  {
    key: 'ops',
    label: 'عملیات روزانه',
    items: [
      { href: '/admin', label: 'داشبورد', icon: '🏠' },
      { href: '/admin/orders', label: 'سفارش‌ها', icon: '🛒' },
      { href: '/admin/orders/new', label: 'ثبت سفارش حضوری', icon: '➕' },
      { href: '/admin/customers', label: 'مشتریان', icon: '👥' },
    ],
  },
  {
    key: 'catalog',
    label: 'کاتالوگ و منو',
    items: [
      { href: '/admin/products', label: 'محصولات', icon: '☕' },
      { href: '/admin/categories', label: 'دسته‌ها', icon: '📂' },
      { href: '/admin/tables', label: 'میزها', icon: '🪑' },
      { href: '/admin/themes', label: 'تم‌ها', icon: '🎨' },
      { href: '/admin/quotes', label: 'جملات', icon: '💬' },
    ],
  },
  {
    key: 'loyalty',
    label: 'باشگاه و وفاداری',
    items: [
      { href: '/admin/memberships', label: 'باشگاه مشتریان', icon: '🎓' },
      { href: '/admin/settings/grades', label: 'گرید مشتریان', icon: '🏆' },
      { href: '/admin/settings/subscriptions', label: 'اشتراک ماهیانه', icon: '⭐' },
      { href: '/admin/coupons', label: 'کد تخفیف', icon: '🎟️' },
      { href: '/admin/settings/club', label: 'قوانین اعتبار', icon: '🛡️' },
    ],
  },
  {
    key: 'wallet',
    label: 'کیف پول',
    items: [{ href: '/admin/wallet', label: 'کیف پول مشتریان', icon: '👛' }],
  },
  {
    key: 'reports',
    label: 'گزارش‌ها',
    items: [
      { href: '/admin/reports/sales', label: 'گزارش فروش', icon: '💰' },
      { href: '/admin/cancellations', label: 'آمار لغوها', icon: '📊' },
      { href: '/admin/cancellation-reasons', label: 'دلایل لغو', icon: '🚫' },
    ],
  },
  {
    key: 'system',
    label: 'سیستم',
    items: [
      { href: '/admin/settings', label: 'تنظیمات', icon: '⚙️' },
      { href: '/admin/settings/payment', label: 'تنظیمات پرداخت', icon: '💳' },
      { href: '/admin/settings/sms', label: 'تنظیمات پیامک', icon: '📱' },
      { href: '/admin/backup', label: 'پشتیبان‌گیری', icon: '💾' },
    ],
  },
] as const

// 🎯 پچ ۴۲: کلید ذخیره وضعیت گروه‌های تاشو
const NAV_GROUPS_KEY = 'cafe-park-admin-nav-groups'

// 🎯 پچ ۵۰-هـ: کلید وضعیت پین سایدبار در صفحهٔ POS
const POS_SIDEBAR_PIN_KEY = 'cafe-park-pos-sidebar-pinned'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // 🎯 پچ ۴۲: گروه‌های تاشو — undefined/open باز، false بسته؛ پس از mount از localStorage بازیابی می‌شود
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const isLoginPage = pathname === '/admin/login'

  // 🎯 پچ ۵۰-هـ: سایدبار خود-پنهان در صفحهٔ POS — با hover باز می‌شود، با پین ثابت می‌ماند
  const [posSidebarOpen, setPosSidebarOpen] = useState(false)
  const [posSidebarPinned, setPosSidebarPinned] = useState(false)
  const isPosPage = pathname === '/admin/orders/new'
  const sidebarVisible = isPosPage && (posSidebarOpen || posSidebarPinned)

  const {
    pendingCount,
    newOrders,
    flash,
    dismissOrder,
    dismissAll,
  } = useOrderNotifications(!isLoginPage)
  useDocumentTitle(pendingCount)

  // ✅ بستن drawer در تغییر مسیر
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // 🎯 پچ ۴۲: وضعیت فعال بودن لینک — از effects پایین هم استفاده می‌شود
  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    if (href === '/admin/orders') {
      return (
        pathname.startsWith('/admin/orders') &&
        !pathname.startsWith('/admin/orders/new')
      )
    }
    return pathname.startsWith(href)
  }

  // 🎯 پچ ۴۲: باز/بسته کردن گروه + ذخیره در localStorage
  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !(prev[key] !== false) }
      try {
        localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // 🎯 پچ ۴۲: بازیابی وضعیت ذخیره‌شده پس از mount (بدون hydration mismatch)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NAV_GROUPS_KEY) || '{}')
      if (saved && typeof saved === 'object') setOpenGroups(saved)
    } catch {}
  }, [])

  // 🎯 پچ ۵۰-هـ: بازیابی وضعیت پین پس از mount (بدون hydration mismatch)
  useEffect(() => {
    try {
      setPosSidebarPinned(localStorage.getItem(POS_SIDEBAR_PIN_KEY) === '1')
    } catch {}
  }, [])

  // 🎯 پچ ۵۰-هـ: پین/برداشتن پین + ذخیره در localStorage
  const togglePosPin = () => {
    setPosSidebarPinned((p) => {
      const next = !p
      try {
        localStorage.setItem(POS_SIDEBAR_PIN_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  // 🎯 پچ ۵۰-هـ: ESC سایدبار خود-پنهان را می‌بندد (وقتی پین نیست)
  useEffect(() => {
    if (!isPosPage || posSidebarPinned) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPosSidebarOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPosPage, posSidebarPinned])

  // 🎯 پچ ۵۰-هـ: خروج از صفحهٔ POS → سایدبار به حالت عادی برمی‌گردد
  useEffect(() => {
    if (!isPosPage) setPosSidebarOpen(false)
  }, [isPosPage])

  // 🎯 پچ ۴۲: گروهِ مسیرِ فعال همیشه باز دیده شود (مانند فایل‌برمرها)
  useEffect(() => {
    if (pathname === '/admin/login') return
    const g = MENU_GROUPS.find((gr) => gr.items.some((i) => isActive(i.href)))
    if (g) {
      setOpenGroups((prev) =>
        prev[g.key] === false ? { ...prev, [g.key]: true } : prev
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ✅ بستن drawer با ESC
  useEffect(() => {
    if (!drawerOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [drawerOpen])

    // ✅ قفل اسکرول صفحه وقتی drawer بازه (روش قفل مطلق با position: fixed)
  useEffect(() => {
    if (!drawerOpen) return

    const scrollY = window.scrollY
    const body = document.body

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    return () => {
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [drawerOpen])

  useEffect(() => {
    try {
      if (localStorage.getItem('cafe-park-admin-theme') === 'dark') {
        document.querySelector('.admin-shell')?.classList.add('dark-mode')
      }
    } catch {}

    if (pathname === '/admin/login') {
      setChecking(false)
      return
    }

    // 🎯 پچ ۴۱: احراز هویت فقط یک‌بار در mount — قبلاً در هر تغییر مسیر
    // getUser() به سرور auth درخواست شبکه می‌زد و هر ناوبری را کند می‌کرد.
    const supabase = supabaseBrowser()
    let mounted = true

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return
        if (!data.user) {
          router.replace('/admin/login')
          return
        }
        setChecking(false)

        try {
          if ('Notification' in window && Notification.permission === 'default') {
            setTimeout(() => {
              Notification.requestPermission().catch(() => {})
            }, 3000)
          }
        } catch {}
      })
      .catch(() => {
        if (mounted) router.replace('/admin/login')
      })

    // خروج در تب دیگر → این تب هم به لاگین برود
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/admin/login')
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (pathname === '/admin/login') {
    return <main>{children}</main>
  }

  const handleLogout = async () => {
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  // 🎯 پچ ۴۱: شل همیشه رندر می‌شود — در حالت checking فقط محتوا اسکلتون است
  // (قبلاً صفحه لخت «در حال بررسی...» کل پنل از جمله سایدبار را می‌بست)
  return (
    <div
      className={
        'admin-shell' +
        (isPosPage ? ' admin-shell--autohide' : '') +
        (sidebarVisible ? ' admin-sidebar-open' : '') +
        (isPosPage && posSidebarPinned ? ' admin-sidebar-pinned' : '')
      }
    >
      {/* 🎯 پچ ۵۰-هـ: دستگیرهٔ لبهٔ راست — hover یا کلیک، منو را باز می‌کند */}
      {isPosPage && !posSidebarPinned && (
        <button
          type="button"
          className="admin-sidebar-handle"
          aria-label="باز کردن منو"
          title="منو"
          onMouseEnter={() => setPosSidebarOpen(true)}
          onClick={() => setPosSidebarOpen((o) => !o)}
        >
          ☰
        </button>
      )}

      {/* 🎯 پچ ۵۰-هـ: پس‌زمینهٔ شفاف — کلیک بیرون منو، منو را می‌بندد */}
      {sidebarVisible && !posSidebarPinned && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setPosSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ═══════════ هدر موبایل (فقط < 768px) ═══════════ */}
      <header className="admin-mobile-header">
        <button
          type="button"
          className="admin-mobile-menu-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="باز کردن منو"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className="admin-mobile-logo">☕ کافه پارک</div>
        {pendingCount > 0 && (
          <span className="admin-mobile-header-badge">
            {pendingCount.toLocaleString('fa-IR')}
          </span>
        )}
      </header>

      {/* ═══════════ سایدبار دسکتاپ (فقط ≥ 768px) ═══════════ */}
      <aside
        className="admin-sidebar"
        onMouseEnter={() => setPosSidebarOpen(true)}
        onMouseLeave={() => {
          if (!posSidebarPinned) setPosSidebarOpen(false)
        }}
      >
        <div className="admin-sidebar-header">
          <div className="admin-logo">☕ کافه پارک</div>
          <div className="admin-logo-sub">پنل مدیریت</div>
          {/* 🎯 پچ ۵۰-هـ: پین — منو باز و ثابت می‌ماند (مثلاً هنگام زدن فاکتور) */}
          {isPosPage && (
            <button
              type="button"
              className={`admin-pos-pin${posSidebarPinned ? ' pinned' : ''}`}
              onClick={togglePosPin}
              title="پین کردن منو"
            >
              📌 {posSidebarPinned ? 'منو پین شد' : 'پین کردن منو'}
            </button>
          )}
        </div>

        <nav className="admin-nav">
          {MENU_GROUPS.map((group) => {
            const collapsed = openGroups[group.key] === false
            return (
              <div
                key={group.key}
                className={`admin-nav-group${collapsed ? ' collapsed' : ''}`}
              >
                <button
                  type="button"
                  className="admin-nav-group-label"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!collapsed}
                >
                  <span>{group.label}</span>
                  <span className="admin-nav-group-chevron">▾</span>
                </button>
                <div className="admin-nav-group-items">
                  {group.items.map((item) => {
                    const isOrders = item.href === '/admin/orders'
                    const hasBadge = isOrders && pendingCount > 0

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`admin-nav-item ${
                          isActive(item.href) ? 'active' : ''
                        }`}
                      >
                        <span className="admin-nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                        {hasBadge && (
                          <span
                            className={`admin-nav-badge ${flash ? 'flash' : ''}`}
                          >
                            {pendingCount.toLocaleString('fa-IR')}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <Link
            href="/"
            target="_blank"
            className="admin-nav-item"
            style={{ marginBottom: 8 }}
          >
            <span className="admin-nav-icon">🌐</span>
            <span>مشاهده منو</span>
          </Link>

          <AdminThemeToggle />

          <button onClick={handleLogout} className="admin-logout-btn">
            <span className="admin-nav-icon">🚪</span>
            <span>خروج</span>
          </button>
        </div>
      </aside>

      {/* ═══════════ محتوای اصلی — در checking اسکلتون به‌جای صفحه لخت ═══════════ */}
      <main className="admin-main">
        {checking ? (
          <div aria-busy="true">
            <div className="skel-card admin-skel-bar" />
            <div className="skel-card" />
            <div className="skel-card" />
          </div>
        ) : (
          children
        )}
      </main>

      {/* ═══════════ Drawer موبایل ═══════════ */}
      {drawerOpen && (
        <>
          <div
            className="admin-drawer-overlay"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="admin-drawer" role="navigation">
            <div className="admin-drawer-header">
              <div>
                <div className="admin-drawer-logo">☕ کافه پارک</div>
                <div className="admin-drawer-logo-sub">پنل مدیریت</div>
              </div>
              <button
                type="button"
                className="admin-drawer-close"
                onClick={() => setDrawerOpen(false)}
                aria-label="بستن منو"
              >
                ✕
              </button>
            </div>

            <nav className="admin-drawer-nav">
              {MENU_GROUPS.map((group) => {
                const collapsed = openGroups[group.key] === false
                return (
                  <div
                    key={group.key}
                    className={`admin-drawer-group${collapsed ? ' collapsed' : ''}`}
                  >
                    <button
                      type="button"
                      className="admin-drawer-group-label"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={!collapsed}
                    >
                      <span>{group.label}</span>
                      <span className="admin-drawer-group-chevron">▾</span>
                    </button>
                    <div className="admin-drawer-group-items">
                      {group.items.map((item) => {
                        const isOrders = item.href === '/admin/orders'
                        const hasBadge = isOrders && pendingCount > 0

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`admin-drawer-item ${
                              isActive(item.href) ? 'active' : ''
                            }`}
                            onClick={() => setDrawerOpen(false)}
                          >
                            <span className="admin-drawer-icon">{item.icon}</span>
                            <span className="admin-drawer-label">{item.label}</span>
                            {hasBadge && (
                              <span className="admin-drawer-badge">
                                {pendingCount.toLocaleString('fa-IR')}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </nav>

            <div className="admin-drawer-footer">
              <Link
                href="/"
                target="_blank"
                className="admin-drawer-item admin-drawer-footer-cell"
                onClick={() => setDrawerOpen(false)}
              >
                <span className="admin-drawer-icon">🌐</span>
                <span className="admin-drawer-label">مشاهده منو</span>
              </Link>

              {/* 🎯 پچ ۴۴: سوییچ فشرده روز/شب — بدون متن */}
              <div className="admin-drawer-footer-cell admin-drawer-footer-switch">
                <AdminThemeToggle />
              </div>

              <button
                onClick={handleLogout}
                className="admin-drawer-logout admin-drawer-footer-cell"
              >
                <span className="admin-drawer-icon">🚪</span>
                <span className="admin-drawer-label">خروج</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ✅ هشدار سفارش‌های جدید */}
      <NewOrderAlert
        orders={newOrders}
        onDismiss={dismissOrder}
        onDismissAll={dismissAll}
      />
    </div>
  )
}
