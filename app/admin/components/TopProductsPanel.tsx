'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TopProduct } from '@/lib/dashboard-stats'

// 🎯 پچ ۷۱ — تب «پرفروش‌ها» به‌صورت on-demand
//   داده فقط وقتی تب باز شود از API خوانده می‌شود (کوئری jsonb آیتم‌ها سنگین است
//   و نباید در لود اولیهٔ داشبورد بیاید).

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(price))

export default function TopProductsPanel() {
  const [top, setTop] = useState<TopProduct[] | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'done'>('loading')

  const load = useCallback(() => {
    setState('loading')
    fetch('/api/admin/dashboard/stats?part=top', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.top)) {
          setTop(d.top as TopProduct[])
          setState('done')
        } else {
          setState('error')
        }
      })
      .catch(() => setState('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state === 'loading') {
    return (
      <section className="dashboard-section" aria-busy="true">
        <h2>⭐ پرفروش‌ترین محصولات (۳۰ روز اخیر)</h2>
        <div className="skel-card" />
        <div className="skel-card" />
      </section>
    )
  }

  if (state === 'error' || top === null) {
    return (
      <section className="dashboard-section">
        <h2>⭐ پرفروش‌ترین محصولات (۳۰ روز اخیر)</h2>
        <div className="admin-card">
          <p className="empty-admin">
            خطا در بارگذاری فهرست پرفروش‌ها —{' '}
            <button type="button" onClick={load} className="dash-retry-btn">
              دوباره تلاش کن
            </button>
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-section">
      <h2>⭐ پرفروش‌ترین محصولات (۳۰ روز اخیر)</h2>
      {top.length === 0 ? (
        <div className="admin-card">
          <p className="empty-admin">هنوز فروشی ثبت نشده است.</p>
        </div>
      ) : (
        <div className="top-products-list">
          {top.map((product, idx) => (
            <div key={product.name} className="top-product-item">
              <div className="top-product-rank">#{formatPrice(idx + 1)}</div>
              <div className="top-product-info">
                <strong>{product.name}</strong>
                <small>
                  {formatPrice(product.count)} عدد فروش ·{' '}
                  {formatPrice(product.revenue)} تومان
                </small>
              </div>
              <div className="top-product-bar">
                <div
                  className="top-product-bar-fill"
                  style={{
                    width: `${(product.count / top[0].count) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
