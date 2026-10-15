'use client'
import AdminThemeToggle from './components/AdminThemeToggle'
import AdminMobileThemeToggle from './components/AdminMobileThemeToggle'  // ← جدید
import NewOrderAlert from './components/NewOrderAlert'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import AdminThemeToggle from './components/AdminThemeToggle'
import NewOrderAlert from './components/NewOrderAlert'
import { useOrderNotifications } from '@/lib/use-order-notifications'
import { useDocumentTitle } from '@/lib/use-document-title'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const isLoginPage = pathname === '/admin/login'

  const {
    pendingCount,
    newOrders,
    flash,
    dismissOrder,
    dismissAll,
  } = useOrderNotifications(!isLoginPage)
    useDocumentTitle(pendingCount)

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

    const checkUser = async () => {
      const supabase = supabaseBrowser()
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.replace('/admin/login')
        return
      }

      try {
        if (
          'Notification' in window &&
          Notification.permission === 'default'
        ) {
          setTimeout(() => {
            Notification.requestPermission().catch(() => {})
          }, 3000)
        }
      } catch {}

      setChecking(false)
    }

    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (pathname === '/admin/login') {
    return <main>{children}</main>
  }

  if (checking) {
    return <div style={{ padding: 24 }}>در حال بررسی...</div>
  }

  const handleLogout = async () => {
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

      const menuItems = [
    { href: '/admin', label: 'داشبورد', icon: '🏠' },
    { href: '/admin/orders', label: 'سفارش‌ها', icon: '🛒' },
    { href: '/admin/customers', label: 'مشتریان', icon: '👥' },
    { href: '/admin/products', label: 'محصولات', icon: '☕' },
    { href: '/admin/categories', label: 'دسته‌ها', icon: '📂' },
    { href: '/admin/tables', label: 'میزها', icon: '🪑' },
    { href: '/admin/themes', label: 'تم‌ها', icon: '🎨' },
    { href: '/admin/quotes', label: 'جملات', icon: '💬' },
    { href: '/admin/coupons', label: 'کد تخفیف', icon: '🎟️' },
    { href: '/admin/cancellation-reasons', label: 'دلایل لغو', icon: '🚫' },
    { href: '/admin/cancellations', label: 'آمار لغوها', icon: '📊' },
    { href: '/admin/reports/sales', label: 'گزارش فروش', icon: '💰' },
    { href: '/admin/settings', label: 'تنظیمات', icon: '⚙️' },
  ]

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo">☕ کافه پارک</div>
          <div className="admin-logo-sub">پنل مدیریت</div>
        </div>

        <nav className="admin-nav">
          {menuItems.map((item) => {
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
        </nav>
		{/* ✅ دکمه شناور حالت شبانه برای موبایل */}
      <AdminMobileThemeToggle />

      {/* ✅ هشدار سفارش‌های جدید */}
      <NewOrderAlert
        orders={newOrders}
        onDismiss={dismissOrder}
        onDismissAll={dismissAll}
      />
    </div>
  )
}

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

      <main className="admin-main">{children}</main>

      <nav className="admin-mobile-nav">
        {menuItems.map((item) => {
          const isOrders = item.href === '/admin/orders'
          const hasBadge = isOrders && pendingCount > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-mobile-item ${
                isActive(item.href) ? 'active' : ''
              }`}
            >
              <span className="admin-mobile-icon-wrapper">
                {item.icon}
                {hasBadge && (
                  <span
                    className={`admin-mobile-badge ${flash ? 'flash' : ''}`}
                  >
                    {pendingCount.toLocaleString('fa-IR')}
                  </span>
                )}
              </span>
              <small>{item.label}</small>
            </Link>
          )
        })}
      </nav>

      {/* ✅ هشدار سفارش‌های جدید */}
      <NewOrderAlert
        orders={newOrders}
        onDismiss={dismissOrder}
        onDismissAll={dismissAll}
      />
    </div>
  )
}