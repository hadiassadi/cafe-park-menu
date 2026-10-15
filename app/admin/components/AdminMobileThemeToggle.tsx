'use client'

import { useEffect, useState } from 'react'

export default function AdminMobileThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('cafe-park-admin-theme')
      if (saved === 'dark') {
        setIsDark(true)
        document.querySelector('.admin-shell')?.classList.add('dark-mode')
      }
    } catch {}
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    try {
      if (next) {
        localStorage.setItem('cafe-park-admin-theme', 'dark')
        document.querySelector('.admin-shell')?.classList.add('dark-mode')
      } else {
        localStorage.setItem('cafe-park-admin-theme', 'light')
        document.querySelector('.admin-shell')?.classList.remove('dark-mode')
      }
    } catch {}
  }

  if (!mounted) return null

  return (
    <button
      type="button"
      className="admin-mobile-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'حالت روز' : 'حالت شبانه'}
      title={isDark ? 'حالت روز' : 'حالت شبانه'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}