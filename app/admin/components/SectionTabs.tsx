'use client'

import { useEffect, useState, type ReactNode } from 'react'
import './section-tabs.css'

// 🎯 پچ ۶۹ — تب‌های داخلی بخش‌ها: هر صفحهٔ بلندِ ادمین می‌تواند بخش‌هایش را
// به‌صورت تب بدهد تا کاربر برای رسیدن به هر قسمت اسکرول طولانی نکند.
// نوارِ تب‌های بالای صفحه (پچ ۶۶) جای خود دارد؛ این کامپوننت لایهٔ دوم است.
// هستهٔ هر تب سمت سرور رندر می‌شود و به‌صورت node به این کامپوننت کلاینت
// پاس داده می‌شود (الگوی استاندارد RSC) — پس داده‌ها و گیتِ نقش دست‌نخورده‌اند.
//
// استفاده: <SectionTabs tabs={[{ id, label, icon?, node }]} />
//   - اگر فقط یک تب باشد، نوار نمایش داده نمی‌شود و محتوا مستقیم می‌آید
//   - تب فعال در hash نشانی ذخیره می‌شود؛ رفرش صفحه همان تب را نگه می‌دارد

export type SectionTabDef = {
  id: string
  label: string
  icon?: string
  node: ReactNode
}

export default function SectionTabs({ tabs }: { tabs: SectionTabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')

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

  // تک‌تب: اصلاً نوار لازم نیست — محتوا مستقیم رندر می‌شود
  if (tabs.length <= 1) {
    return <div className="section-tabs">{tabs[0]?.node ?? null}</div>
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
      </div>
      <div className="section-tabs-panel" key={current.id}>
        {current.node}
      </div>
    </div>
  )
}
