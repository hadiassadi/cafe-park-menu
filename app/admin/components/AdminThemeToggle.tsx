'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cafe-park-admin-theme'

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
      <button className="admin-nav-item" disabled>
        <span className="admin-nav-icon">🌙</span>
        <span>حالت شبانه</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="admin-nav-item"
      aria-label={isDark ? 'حالت روز' : 'حالت شبانه'}
    >
      <span className="admin-nav-icon">{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'حالت روز' : 'حالت شبانه'}</span>
    </button>
  )
}