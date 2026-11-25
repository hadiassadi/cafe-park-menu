'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import './section-tabs.css'

// 🎯 پچ ۶۹ — تب‌های داخلی بخش‌ها: هر صفحهٔ بلندِ ادمین می‌تواند بخش‌هایش را
// به‌صورت تب بدهد تا کاربر برای رسیدن به هر قسمت اسکرول طولانی نکند.
// نوارِ تب‌های بالای صفحه (پچ ۶۶) جای خود دارد؛ این کامپوننت لایهٔ دوم است.
// هستهٔ هر تب سمت سرور رندر می‌شود و به‌صورت node به این کامپوننت کلاینت
// پاس داده می‌شود (الگوی استاندارد RSC) — پس داده‌ها و گیتِ نقش دست‌نخورده‌اند.
//
// استفاده: <SectionTabs tabs={[{ id, label, icon?, node }]} />
//   - اگر فقط یک تب باشد، نوار نمایش داده نمی‌شود و محتوا مستقیم می‌آید
//   - تب فعال در hash نشانی ذخیره می‌شود؛ رفرش صفحه همان تب را نگه می‌داند
//
// 🎯 پچ ۷۴ — مخفی‌کردن سریع از خود داشبورد:
//   اگر hideOrder (ترتیب فعلی ویجت‌های این کاربر) پاس داده شود، انتهای نوار
//   یک ✕ می‌آید که تبِ فعال را از داشبورد این کاربر حذف می‌کند (PUT
//   dashboard/prefs با همان ترتیب منهای تب فعال) و router.refresh() صفحه را
//   بدون آن بازمی‌سازد. وقتی چیدمان قفل است صفحه hideOrder نمی‌فرستد → نه ✕
//   هست نه حذف. بازگرداندن: ⚙️ تنظیم داشبورد → تیک همان بخش.

export type SectionTabDef = {
  id: string
  label: string
  icon?: string
  node: ReactNode
}

export default function SectionTabs({
  tabs,
  hideOrder,
}: {
  tabs: SectionTabDef[]
  hideOrder?: string[]
}) {
  const router = useRouter()
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  const [hiding, setHiding] = useState(false)

  // بعد از مونت: اگر hash صفحه به یکی از تب‌ها اشاره می‌کرد، همان فعال شود
  useEffect(() => {
    const h = window.location.hash.replace('#', '')
    if (h && tabs.some((t) => t.id === h)) setActive(h)
  }, [tabs])

  const select = (id: string) => {
    setActive(id)
    try {
      window.history.replaceState(null, '', `#${id}`)
    } catch {}
  }

  // 🎯 پچ ۷۴: حذف تبِ فعال از چیدمانِ همین کاربر
  // (برچسب را از tabs می‌گیریم نه از current — چون در مسیر تک‌تب، current
  // هنوز تعریف نشده و دسترسی به آن خطای TDZ می‌دهد)
  const canHide = Array.isArray(hideOrder) && hideOrder.length > 0
  const hideActive = async () => {
    if (!canHide || hiding) return
    const label = tabs.find((t) => t.id === active)?.label ?? 'این بخش'
    if (!window.confirm(`بخش «${label}» از داشبوردت مخفی شود؟ (از ⚙️ تنظیم داشبورد قابل بازگرداندن است)`))
      return
    setHiding(true)
    try {
      const r = await fetch('/api/admin/dashboard/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgets: hideOrder!.filter((x) => x !== active),
        }),
      })
      if (r.ok) router.refresh()
    } catch {}
    setHiding(false)
  }

  // تک‌تب: نوار لازم نیست — محتوا مستقیم می‌آید؛ فقط ✕ (اگر چیدمان باز باشد)
  if (tabs.length <= 1) {
    if (!canHide) return <div className="section-tabs">{tabs[0]?.node ?? null}</div>
    return (
      <div className="section-tabs">
        <div className="section-tabs-bar section-tabs-bar--single" role="tablist" aria-label="بخش‌های صفحه">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected="true"
              className="section-tab-btn active"
              onClick={() => select(t.id)}
            >
              {t.icon ? <span className="section-tab-icon">{t.icon}</span> : null}
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className="section-tab-hide"
            onClick={hideActive}
            disabled={hiding}
            title="مخفی کردن این بخش از داشبورد"
            aria-label="مخفی کردن این بخش از داشبورد"
          >
            {hiding ? '…' : '✕'}
          </button>
        </div>
        <div className="section-tabs-panel" key={active}>
          {tabs[0]?.node ?? null}
        </div>
      </div>
    )
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  return (
    <div className="section-tabs">
      <div className="section-tabs-bar" role="tablist" aria-label="بخش‌های صفحه">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            className={`section-tab-btn${t.id === current.id ? ' active' : ''}`}
            onClick={() => select(t.id)}
          >
            {t.icon ? <span className="section-tab-icon">{t.icon}</span> : null}
            {t.label}
          </button>
        ))}
        {canHide && (
          <button
            type="button"
            className="section-tab-hide"
            onClick={hideActive}
            disabled={hiding}
            title={`مخفی کردن «${current.label}» از داشبورد`}
            aria-label="مخفی کردن بخش فعال از داشبورد"
          >
            {hiding ? '…' : '✕'}
          </button>
        )}
      </div>
      <div className="section-tabs-panel" key={current.id}>
        {current.node}
      </div>
    </div>
  )
}
