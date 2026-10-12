'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // اگه قبلاً نصب شده یا کاربر رد کرده، نشون نده
    const dismissed = localStorage.getItem('pwa-dismissed')
    if (dismissed === 'true') return

    // چک کن آیا در حالت standalone هست (یعنی نصب شده)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // بعد از ۵ ثانیه دکمه رو نشون بده
      setTimeout(() => setShowPrompt(true), 5000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowPrompt(false)
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    setShowPrompt(false)
    localStorage.setItem('pwa-dismissed', 'true')
  }

  if (!showPrompt || isInstalled || !deferredPrompt) return null

  return (
    <div className="pwa-prompt">
      <div className="pwa-prompt-icon">📱</div>
      <div className="pwa-prompt-content">
        <strong>نصب منوی کافه پارک</strong>
        <small>دسترسی سریع از صفحه اصلی گوشی</small>
      </div>
      <button
        type="button"
        className="pwa-prompt-install"
        onClick={handleInstall}
      >
        نصب
      </button>
      <button
        type="button"
        className="pwa-prompt-close"
        onClick={handleDismiss}
        aria-label="بستن"
      >
        ✕
      </button>
    </div>
  )
}