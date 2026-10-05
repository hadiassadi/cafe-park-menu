'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
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

      setChecking(false)
    }

    checkUser()
  }, [pathname, router])

  // صفحه لاگین منو نداره
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
    { href: '/admin/products', label: 'محصولات', icon: '☕' },
    { href: '/admin/categories', label: 'دسته‌ها', icon: '📂' },
    { href: '/admin/themes', label: 'تم‌ها', icon: '🎨' },
    { href: '/admin/quotes', label: 'جملات', icon: '💬' },
    { href: '/admin/settings', label: 'تنظیمات', icon: '⚙️' },
  ]

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="admin-shell">
      {/* سایدبار */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo">☕ کافه پارک</div>
          <div className="admin-logo-sub">پنل مدیریت</div>
        </div>

        <nav className="admin-nav">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item ${
                isActive(item.href) ? 'active' : ''
              }`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
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

          <button onClick={handleLogout} className="admin-logout-btn">
            <span className="admin-nav-icon">🚪</span>
            <span>خروج</span>
          </button>
        </div>
      </aside>

      {/* محتوا */}
      <main className="admin-main">{children}</main>

      {/* منوی موبایل */}
      <nav className="admin-mobile-nav">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-mobile-item ${
              isActive(item.href) ? 'active' : ''
            }`}
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </div>
  )
}