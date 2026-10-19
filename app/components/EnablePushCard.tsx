'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cafe-push-prompt-dismissed'

function urlBase64ToUint8Array(
  base64String: string
): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function EnablePushCard({ orderId }: { orderId: string }) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (!('serviceWorker' in navigator)) return
    if (!('PushManager' in window)) return

    if (Notification.permission === 'granted') return
    if (Notification.permission === 'denied') return

    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {}

    setVisible(true)
  }, [])

  async function handleEnable() {
    setLoading(true)
    setError(null)

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('اجازه اعلان داده نشد. از تنظیمات مرورگر می‌تونی فعال کنی.')
        return
      }

      // ثبت SW اگه قبلاً نبوده
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js')
      }
      await navigator.serviceWorker.ready

      // گرفتن public key
      const keyRes = await fetch('/api/push/vapid-public-key', {
        cache: 'no-store',
      })
      const keyData = await keyRes.json()
      if (!keyData.publicKey) {
        throw new Error('VAPID key unavailable')
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          orderId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'خطا در ذخیره اشتراک')
      }

      setSuccess(true)
      setTimeout(() => setVisible(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته')
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="enable-push-card">
      <div className="enable-push-icon">🔔</div>
      <div className="enable-push-body">
        <strong className="enable-push-title">
          می‌خوای وقتی سفارشت آماده شد بهت خبر بدیم؟
        </strong>
        <p className="enable-push-text">
          حتی اگه سایت رو ببندی، بهت اطلاع می‌دیم. فقط یه بار اجازه اعلان
          می‌خوایم.
        </p>
        {error && <div className="enable-push-error">❌ {error}</div>}
        {success && (
          <div className="enable-push-success">
            ✅ اشتراک فعال شد! از این به بعد خبرت می‌کنیم.
          </div>
        )}
        {!success && (
          <div className="enable-push-actions">
            <button
              type="button"
              className="enable-push-btn primary"
              onClick={handleEnable}
              disabled={loading}
            >
              {loading ? '...' : '✅ بله، خبرم کن'}
            </button>
            <button
              type="button"
              className="enable-push-btn secondary"
              onClick={handleDismiss}
              disabled={loading}
            >
              بعداً
            </button>
          </div>
        )}
      </div>
    </div>
  )
}