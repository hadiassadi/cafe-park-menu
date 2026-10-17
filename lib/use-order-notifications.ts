'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
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

  // ✅ نمایش تعداد سفارش‌های pending روی آیکون PWA
  usePwaBadge(pendingCount)

  // ─── فعال‌سازی صدا با اولین کلیک ───
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (audioUnlocked) return

    function unlockAudio() {
      try {
        const AC =
          window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return

        if (!audioContextRef.current) {
          audioContextRef.current = new AC()
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume()
        }
        setAudioUnlocked(true)
        console.log('🔊 Audio unlocked')
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

  // ─── پاکسازی ───
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [])

  // ─── Polling (بررسی دوره‌ای) ───
  useEffect(() => {
    if (!enabled) {
      console.log('🔕 Notifications disabled')
      return
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) {
      console.error('❌ Supabase env missing')
      return
    }

    console.log('🔔 Setting up polling (every 10s)...')
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    let cancelled = false

    async function checkOrders() {
      if (cancelled) return

      try {
                        const { data, error } = await db
          .from('orders')
          .select(
            'id, order_number, customer_name, customer_phone, table_number, subtotal, items, created_at, status, payment_method, payment_status, payment_receipt_url'
          )
          .eq('status', 'pending')
          .or(
            'payment_method.in.(cash,card),payment_method.is.null,payment_status.eq.paid,and(payment_status.eq.pending_review,payment_receipt_url.not.is.null)'
          )
          .order('created_at', { ascending: false })
          .limit(20)

        if (cancelled || error || !data) return

        // ─── پیدا کردن سفارش‌های جدید ───
        const newOnes = data.filter(
          (o) => !knownOrderIdsRef.current.has(o.id)
        )

        // اگه اولین بار نیست و سفارش جدید داریم
        if (!isFirstLoadRef.current && newOnes.length > 0) {
          console.log('🎉 New orders detected:', newOnes.length)

          newOnes.forEach((order) => {
            const info: NewOrderInfo = {
              id: order.id,
              order_number: order.order_number,
              customer_name: order.customer_name,
              customer_phone: order.customer_phone,
              table_number: order.table_number,
              subtotal: order.subtotal,
              items_count: Array.isArray(order.items)
                ? order.items.length
                : 0,
              created_at: order.created_at,
            }

            if (isMountedRef.current) {
              setNewOrders((prev) => [info, ...prev])
            }

            playBeep(audioContextRef)
            showBrowserNotification(
              info.order_number,
              info.customer_name
            )
          })

          if (isMountedRef.current) {
            setFlash(true)
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
            flashTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) setFlash(false)
            }, 6000)
          }
        }

        // ─── آپدیت لیست شناخته‌شده ───
        knownOrderIdsRef.current.clear()
        data.forEach((o) => knownOrderIdsRef.current.add(o.id))

        if (isMountedRef.current) {
          setPendingCount(data.length)
          isFirstLoadRef.current = false
        }
      } catch (e) {
        console.error('Polling error:', e)
      }
    }

    // اجرای اولیه
    checkOrders()

    // هر ۱۰ ثانیه یک بار
    const interval = setInterval(checkOrders, 10000)

    return () => {
      console.log('🔌 Cleanup polling')
      cancelled = true
      clearInterval(interval)
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

// ─── توابع کمکی ───

function playBeep(ref: React.RefObject<AudioContext | null>) {
  try {
    if (typeof window === 'undefined') return

    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return

    if (!ref.current) {
      ref.current = new AC()
    }
    const ctx = ref.current

    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    console.log('🔊 Playing beep...')

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