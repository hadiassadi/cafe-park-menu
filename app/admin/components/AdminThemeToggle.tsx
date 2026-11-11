'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cafe-park-admin-theme'

// 🎯 پچ ۴۴: سوییچ فشرده روز/شب — فقط آیکن، بدون متن (جایگزین دکمه متنی «حالت شبانه»)
export default function AdminThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    setIsDark(saved === 'dark')
  }, [])

  function toggleTheme() {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    localStorage.setItem(STORAGE_KEY, newIsDark ? 'dark' : 'light')

    const shell = document.querySelector('.admin-shell')
    if (shell) {
      shell.classList.toggle('dark-mode', newIsDark)
    }
  }

  if (!mounted) {
    return (
      <button className="admin-theme-switch" disabled aria-label="حالت نمایش">
        <span className="admin-theme-switch-opt">☀️</span>
        <span className="admin-theme-switch-opt">🌙</span>
        <span className="admin-theme-switch-knob" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`admin-theme-switch${isDark ? ' dark' : ''}`}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'رفتن به حالت روز' : 'رفتن به حالت شبانه'}
      title={isDark ? 'حالت روز' : 'حالت شبانه'}
    >
      <span className="admin-theme-switch-opt">☀️</span>
      <span className="admin-theme-switch-opt">🌙</span>
      <span className="admin-theme-switch-knob" />
    </button>
  )
}
