'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // ✅ فقط در production فعال باشه
    if (process.env.NODE_ENV !== 'production') return

    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope)
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error)
      })
  }, [])

  return null
}