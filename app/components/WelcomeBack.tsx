'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPersianDate } from '@/lib/format-date'
import type { Settings } from '@/lib/menu-types'

// پیام‌های خوش‌آمد — این پیش‌فرض‌ها وقتی به‌کار می‌روند که ادمین هنوز چیزی تنظیم نکرده باشد.
// لحن مرجع همه‌ی پیام‌های سیستم: ایرانی اصیل و گرم («درود بر شما…») — از تنظیمات ادمین قابل ویرایش است.
const DEFAULT_WELCOME_TITLE = 'درود بر شما'
const DEFAULT_WELCOME_BODY =
  'درود بر شما، {name} عزیز! خوش آمدید — خوشحالیم که دوباره مهمان کافه پارک هستیم.'

type CustomerInfo = { name: string; phone: string }
type LastOrderInfo = {
  id: string
  created_at: string
  items?: Array<{ product_name?: string; quantity?: number }> | null
}

// مودال خوش‌آمد در هر نشست فقط یک‌بار باز می‌شود
const SESSION_KEY = 'cafe_welcome_seen_v1'

const safeSrc = (url: string) => url.replace(/"/g, '%22')

export default function WelcomeBack({ settings }: { settings: Settings }) {
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [lastOrder, setLastOrder] = useState<LastOrderInfo | null>(null)
  const [open, setOpen] = useState(false)
  const openedRef = useRef(false)

  useEffect(() => {
    if (settings.welcome_enabled === false) return
    let alive = true
    // ۱) شناسایی مشتری — ناشناس؟ هیچی نمایش داده نمی‌شود
    fetch('/api/customer/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then(async (me) => {
        if (!alive || !me?.customer) return
        setCustomer(me.customer as CustomerInfo)
        // ۲) مشتری شناخته شد → آخرین سفارش برای خط «آخرین حضور»
        const ordersData = await fetch('/api/customer/orders', { cache: 'no-store' })
          .then((r) => r.json())
          .catch(() => null)
        const first: LastOrderInfo | undefined = ordersData?.orders?.[0]
        if (!alive || !first) return
        setLastOrder(first)
        // ۳) مودال فقط یک‌بار در هر نشست
        try {
          if (openedRef.current || sessionStorage.getItem(SESSION_KEY)) return
          openedRef.current = true
          sessionStorage.setItem(SESSION_KEY, '1')
          setOpen(true)
        } catch {}
      })
      .catch(() => {})
    return () => { alive = false }
  }, [settings.welcome_enabled])

  if (settings.welcome_enabled === false || !customer) return null

  const firstName = (customer.name || '').trim().split(/\s+/)[0] || 'کاربر'
  const title = (settings.welcome_title || '').trim() || DEFAULT_WELCOME_TITLE
  const body = ((settings.welcome_body || '').trim() || DEFAULT_WELCOME_BODY).replace(
    /\{name\}/g,
    firstName
  )
  const imageUrl = (settings.welcome_image_url || '').trim()
  const itemsSummary = (lastOrder?.items ?? [])
    .slice(0, 3)
    .map((it) => `${(it.product_name ?? '').trim()}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ''}`)
    .filter(Boolean)
    .join('، ')

  return (
    <>
      <button type="button" className="wb-chip" onClick={() => setOpen(true)}>
        درود بر شما، {firstName} عزیز 👋
      </button>

      {open && (
        <div className="wb-backdrop" onClick={() => setOpen(false)}>
          <div
            className="wb-card"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
          >
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="wb-img" src={safeSrc(imageUrl)} alt="" />
            )}
            <h3 className="wb-title">{title}</h3>
            <p className="wb-body">{body}</p>
            {lastOrder && (
              <div className="wb-visit">
                آخرین حضور شما: {formatPersianDate(lastOrder.created_at, { withTime: false })}
                {itemsSummary ? ` — ${itemsSummary}` : ''}
              </div>
            )}
            <div className="wb-actions">
              <button type="button" className="wb-btn primary" onClick={() => setOpen(false)}>
                🍽 سفارش جدید
              </button>
              {lastOrder && (
                <button
                  type="button"
                  className="wb-btn"
                  onClick={() => router.push(`/my-orders?reorder=${lastOrder.id}`)}
                >
                  🔁 سفارش مجدد
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
