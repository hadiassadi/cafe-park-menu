'use client'

import { useEffect, useRef, useState } from 'react'
import { usePwaBadge } from './use-pwa-badge'

type NewOrderInfo = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  table_number: number | null
  subtotal: number
  items_count: number
  created_at: string
}

export function useOrderNotifications(enabled: boolean = true) {
  const [pendingCount, setPendingCount] = useState(0)
  const [newOrders, setNewOrders] = useState<NewOrderInfo[]>([])
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [flash, setFlash] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const isMountedRef = useRef(true)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownOrderIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)

  usePwaBadge(pendingCount)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (audioUnlocked) return

    function unlockAudio() {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return

        if (!audioContextRef.current) {
          audioContextRef.current = new AC()
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume()
        }
        setAudioUnlocked(true)
      } catch (e) {
        console.error('Audio unlock error:', e)
      }
    }

    const events = ['click', 'touchstart', 'keydown'] as const
    events.forEach((e) =>
      document.addEventListener(e, unlockAudio, { once: true })
    )

    return () => {
      events.forEach((e) => document.removeEventListener(e, unlockAudio))
    }
  }, [audioUnlocked])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let interval: ReturnType<typeof setInterval> | undefined

    function stopPolling() {
      cancelled = true
      if (interval) clearInterval(interval)
    }

    async function checkOrders() {
      if (cancelled) return

      try {
        const res = await fetch('/api/admin/orders/pending', {
          cache: 'no-store',
          credentials: 'same-origin',
        })

        // نشست منقضی یا بدون دسترسی ادمین: polling را متوقف کن
        if (res.status === 401 || res.status === 403) {
          console.warn('[orders] دسترسی ادمین معتبر نیست، polling متوقف شد:', res.status)
          stopPolling()
          if (isMountedRef.current) setPendingCount(0)
          return
        }

        // خطای موقتی (مثلاً 5xx): دور بعد دوباره تلاش می‌شود
        if (!res.ok) return

        const json = await res.json()
        if (cancelled || !json.orders) return

        const data = json.orders

        const newOnes = data.filter((o: any) => !knownOrderIdsRef.current.has(o.id))
        newOnes.forEach((o: any) => knownOrderIdsRef.current.add(o.id))
        if (!isFirstLoadRef.current && newOnes.length > 0) {
          newOnes.forEach((order: any) => {
            const info: NewOrderInfo = {
              id: order.id,
              order_number: order.order_number,
              customer_name: order.customer_name,
              customer_phone: order.customer_phone,
              table_number: order.table_number,
              subtotal: order.subtotal,
              items_count: Array.isArray(order.items) ? order.items.length : 0,
              created_at: order.created_at,
            }

                        if (isMountedRef.current) {
              setNewOrders((prev) =>
                prev.some((o) => o.id === info.id) ? prev : [info, ...prev]
              )
            }
            playBeep(audioContextRef)
            showBrowserNotification(info.order_number, info.customer_name)
          })

          if (isMountedRef.current) {
            setFlash(true)
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
            flashTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) setFlash(false)
            }, 6000)
          }
        }

        knownOrderIdsRef.current.clear()
        data.forEach((o: any) => knownOrderIdsRef.current.add(o.id))

        if (isMountedRef.current) {
          setPendingCount(data.length)
          isFirstLoadRef.current = false
        }
      } catch (e) {
        console.error('Polling error:', e)
      }
    }

    checkOrders()
    interval = setInterval(checkOrders, 10000)

    return () => {
      stopPolling()
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [enabled])

  function dismissOrder(orderId: string) {
    setNewOrders((prev) => prev.filter((o) => o.id !== orderId))
  }

  function dismissAll() {
    setNewOrders([])
  }

  return {
    pendingCount,
    newOrders,
    flash,
    audioUnlocked,
    dismissOrder,
    dismissAll,
  }
}

function playBeep(ref: React.RefObject<AudioContext | null>) {
  try {
    if (typeof window === 'undefined') return
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    if (!ref.current) ref.current = new AC()
    const ctx = ref.current
    if (ctx.state === 'suspended') ctx.resume()

    const frequencies = [880, 1174.66, 880]
    const startTimes = [0, 0.2, 0.4]

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'

      const t = ctx.currentTime + startTimes[i]
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)

      osc.start(t)
      osc.stop(t + 0.25)
    })
  } catch (e) {
    console.error('Beep error:', e)
  }
}

function showBrowserNotification(orderNumber?: number, customerName?: string) {
  try {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const notif = new Notification('🎉 سفارش جدید — کافه پارک', {
      body: `سفارش #${orderNumber ?? '?'} از ${customerName ?? 'مشتری'}`,
      icon: '/icons/icon-192.png',
      tag: 'new-order-' + Date.now(),
      requireInteraction: true,
      silent: true,
    })

    notif.onclick = () => {
      window.focus()
      window.location.href = '/admin/orders'
      notif.close()
    }
  } catch {}
}
