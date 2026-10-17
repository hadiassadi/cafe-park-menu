'use client'

import { useEffect, useMemo, useState } from 'react'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

// Types
type CustomerData = {
  phone: string
  name: string
  order_count: number
  total_spent: number
  cancelled_count: number
  last_order_at: string | null
  first_order_at: string | null
  notes: string | null
  tags: string[]
}

const PRESET_TAGS = [
  { key: 'vip', label: '🌟 VIP', color: 'vip' },
  { key: 'loyal', label: '⭐ مشتری وفادار', color: 'loyal' },
  { key: 'good', label: '👍 مشتری خوب', color: 'good' },
  { key: 'call', label: '📞 بهتره تماس بگیریم', color: 'call' },
  { key: 'problem', label: '⚠️ شاکی', color: 'problem' },
  { key: 'block', label: '🚫 بلاک', color: 'block' },
]

type CustomerFilter = 'all' | 'loyal' | 'new' | 'inactive' | 'problematic'

const FILTER_LABELS: Record<CustomerFilter, string> = {
  all: 'همه',
  loyal: '⭐ وفادار (۵+)',
  new: '🆕 جدید (۱ سفارش)',
  inactive: '💤 غیرفعال (۳۰+ روز)',
  problematic: '⚠️ مشکل‌دار',
}

type CancelFilter = 'all' | '1+' | '3+' | '5+'

const CANCEL_FILTER_LABELS: Record<CancelFilter, string> = {
  all: 'همه',
  '1+': '❌ ۱+ لغو',
  '3+': '⚠️ ۳+ لغو',
  '5+': '🚨 ۵+ لغو',
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'همین الان'
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} روز پیش`
  return `${Math.floor(diff / 2592000)} ماه پیش`
}

export default function CustomersManager() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [summary, setSummary] = useState({
    total: 0,
    loyal: 0,
    new: 0,
    inactive: 0,
    problematic: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CustomerFilter>('all')
  const [cancelFilter, setCancelFilter] = useState<CancelFilter>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // ✅ لود داده‌ها از API امن سرور (نه مستقیم از دیتابیس)
  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/customers', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          if (data.customers) {
            setCustomers(data.customers)
            setSummary(data.summary)
          }
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const cancelCounts = useMemo(() => {
    return {
      all: customers.length,
      '1+': customers.filter((c) => c.cancelled_count >= 1).length,
      '3+': customers.filter((c) => c.cancelled_count >= 3).length,
      '5+': customers.filter((c) => c.cancelled_count >= 5).length,
    }
  }, [customers])

  const filteredCustomers = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let list = customers

    if (filter === 'loyal') {
      list = list.filter((c) => c.order_count >= 5)
    } else if (filter === 'new') {
      list = list.filter((c) => c.order_count === 1)
    } else if (filter === 'inactive') {
      list = list.filter(
        (c) => c.last_order_at && new Date(c.last_order_at) < thirtyDaysAgo
      )
    } else if (filter === 'problematic') {
      list = list.filter((c) => c.cancelled_count >= 2)
    }

    if (cancelFilter === '1+') {
      list = list.filter((c) => c.cancelled_count >= 1)
    } else if (cancelFilter === '3+') {
      list = list.filter((c) => c.cancelled_count >= 3)
    } else if (cancelFilter === '5+') {
      list = list.filter((c) => c.cancelled_count >= 5)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
      )
    }

    if (cancelFilter !== 'all') {
      list = [...list].sort((a, b) => b.cancelled_count - a.cancelled_count)
    }

    return list
  }, [customers, filter, cancelFilter, search])

  function openCustomer(customer: CustomerData) {
    setSelectedCustomer(customer)
    setEditNotes(customer.notes || '')
    setEditTags(customer.tags || [])
    setNewTagInput('')
    setSaveMessage(null)
  }

  function togglePresetTag(tagKey: string) {
    const tagLabel = PRESET_TAGS.find((t) => t.key === tagKey)?.label
    if (!tagLabel) return

    setEditTags((prev) =>
      prev.includes(tagLabel)
        ? prev.filter((t) => t !== tagLabel)
        : [...prev, tagLabel]
    )
  }

  function addCustomTag() {
    const tag = newTagInput.trim()
    if (!tag) return
    if (editTags.includes(tag)) {
      setNewTagInput('')
      return
    }
    setEditTags((prev) => [...prev, tag])
    setNewTagInput('')
  }

  function removeTag(tag: string) {
    setEditTags((prev) => prev.filter((t) => t !== tag))
  }

  async function saveCustomer() {
    if (!selectedCustomer) return
    setSaving(true)
    setSaveMessage(null)

    try {
      const res = await fetch('/api/customers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedCustomer.phone,
          notes: editNotes,
          tags: editTags,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'خطا در ذخیره')
      }

      setCustomers((prev) =>
        prev.map((c) =>
          c.phone === selectedCustomer.phone
            ? { ...c, notes: editNotes, tags: editTags }
            : c
        )
      )
      setSelectedCustomer({
        ...selectedCustomer,
        notes: editNotes,
        tags: editTags,
      })

      setSaveMessage('✅ ذخیره شد')
      setTimeout(() => setSaveMessage(null), 2500)
    } catch (err) {
      setSaveMessage('❌ خطا در ذخیره')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function whatsappLink(phone: string): string {
    const clean = phone.replace(/^0/, '')
    return `https://wa.me/98${clean}?text=${encodeURIComponent(
      'سلام، از کافه پارک تماس می‌گیریم.'
    )}`
  }

  const cancelFilterActive = cancelFilter !== 'all'

  return (
    <div className="admin-main">
      <div className="admin-header">
        <div>
          <h1>👥 مشتریان</h1>
          <p className="admin-subtitle">
            {loading
              ? 'در حال بارگذاری...'
              : `${formatPrice(summary.total)} مشتری ثبت شده`}
          </p>
        </div>
      </div>

      {!loading && (
        <section className="dashboard-section">
          <div className="customers-summary-grid">
            <div className="customers-summary-card">
              <div className="customers-summary-icon" style={{ background: '#e5f0e6' }}>👥</div>
              <div>
                <div className="customers-summary-value">{formatPrice(summary.total)}</div>
                <div className="customers-summary-label">کل مشتریان</div>
              </div>
            </div>

            <div className="customers-summary-card">
              <div className="customers-summary-icon" style={{ background: '#eee6d9' }}>⭐</div>
              <div>
                <div className="customers-summary-value">{formatPrice(summary.loyal)}</div>
                <div className="customers-summary-label">وفادار (۵+)</div>
              </div>
            </div>

            <div className="customers-summary-card">
              <div className="customers-summary-icon" style={{ background: '#e6ecf0' }}>🆕</div>
              <div>
                <div className="customers-summary-value">{formatPrice(summary.new)}</div>
                <div className="customers-summary-label">جدید</div>
              </div>
            </div>

            <div className="customers-summary-card">
              <div className="customers-summary-icon" style={{ background: '#f0e6f0' }}>💤</div>
              <div>
                <div className="customers-summary-value">{formatPrice(summary.inactive)}</div>
                <div className="customers-summary-label">غیرفعال</div>
              </div>
            </div>

            <div className="customers-summary-card">
              <div className="customers-summary-icon" style={{ background: '#fde8e6' }}>⚠️</div>
              <div>
                <div className="customers-summary-value">{formatPrice(summary.problematic)}</div>
                <div className="customers-summary-label">مشکل‌دار</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <div className="customers-toolbar">
          <div className="search-box">
            <span>🔍</span>
            <input
              type="search"
              placeholder="جستجوی نام یا شماره تماس..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="customers-filters">
          {(Object.keys(FILTER_LABELS) as CustomerFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="customers-cancel-filters">
          <span className="customers-cancel-label">🚫 فیلتر لغو:</span>
          <div className="customers-cancel-chips">
            {(Object.keys(CANCEL_FILTER_LABELS) as CancelFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`filter-chip cancel-chip ${
                  cancelFilter === f ? 'active' : ''
                } ${f !== 'all' ? 'chip-danger' : ''}`}
                onClick={() => setCancelFilter(f)}
              >
                {CANCEL_FILTER_LABELS[f]}
                <span className="chip-count">{formatPrice(cancelCounts[f])}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="admin-card">
          <p className="empty-admin">⏳ در حال بارگذاری مشتریان...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="admin-card">
          <p className="empty-admin">
            {search.trim()
              ? 'مشتری‌ای با این مشخصات پیدا نشد.'
              : cancelFilterActive
                ? 'مشتری‌ای با این تعداد لغو پیدا نشد.'
                : 'هنوز مشتری‌ای ثبت نشده است.'}
          </p>
        </div>
      ) : (
        <>
          {cancelFilterActive && (
            <div className="customers-filter-result">
              🎯 {formatPrice(filteredCustomers.length)} مشتری با فیلتر «
              {CANCEL_FILTER_LABELS[cancelFilter]}» پیدا شد
            </div>
          )}

          <div className="customers-grid">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.phone}
                className={`customer-card ${
                  cancelFilterActive && customer.cancelled_count > 0
                    ? 'customer-card-highlight'
                    : ''
                }`}
                onClick={() => openCustomer(customer)}
              >
                <div className="customer-card-header">
                  <div className="customer-avatar">{customer.name.charAt(0)}</div>
                  <div className="customer-info">
                    <strong>{customer.name}</strong>
                    <small dir="ltr">{customer.phone}</small>
                  </div>
                  {customer.order_count >= 5 && (
                    <span className="customer-badge loyal">⭐ وفادار</span>
                  )}
                  {customer.cancelled_count >= 2 && (
                    <span className="customer-badge problem">⚠️</span>
                  )}
                </div>

                <div className="customer-card-body">
                  <div className="customer-stat">
                    <span>🛒</span>
                    <span>{formatPrice(customer.order_count)} سفارش موفق</span>
                  </div>
                  {customer.cancelled_count > 0 && (
                    <div
                      className={`customer-stat customer-stat-cancelled ${
                        cancelFilterActive ? 'cancelled-emphasis' : ''
                      }`}
                    >
                      <span>❌</span>
                      <span>
                        <strong>{formatPrice(customer.cancelled_count)}</strong>{' '}
                        سفارش لغو
                      </span>
                    </div>
                  )}
                  <div className="customer-stat">
                    <span>💰</span>
                    <span>{formatPrice(customer.total_spent)} تومان</span>
                  </div>
                  <div className="customer-stat">
                    <span>🕐</span>
                    <span>آخرین: {timeAgo(customer.last_order_at)}</span>
                  </div>
                </div>

                {customer.tags && customer.tags.length > 0 && (
                  <div className="customer-tags-preview">
                    {customer.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="customer-tag-pill">{tag}</span>
                    ))}
                    {customer.tags.length > 3 && (
                      <span className="customer-tag-pill more">
                        +{customer.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {customer.notes && (
                  <div className="customer-notes-preview">📝 {customer.notes}</div>
                )}

                <div className="customer-actions">
                  <a
                    href={`tel:${customer.phone}`}
                    className="customer-action-btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📞 تماس
                  </a>
                  <a
                    href={whatsappLink(customer.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="customer-action-btn whatsapp"
                    onClick={(e) => e.stopPropagation()}
                  >
                    💬 واتساپ
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedCustomer && (
        <div className="modal-overlay" onClick={() => !saving && setSelectedCustomer(null)}>
          <div className="modal-container modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>{selectedCustomer.name}</h2>
                <p dir="ltr">{selectedCustomer.phone}</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedCustomer(null)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="info-card">
                <h3>📊 آمار</h3>
                <div className="info-row">
                  <span>تعداد سفارش:</span>
                  <strong>{formatPrice(selectedCustomer.order_count)}</strong>
                </div>
                <div className="info-row">
                  <span>مجموع خرید:</span>
                  <strong>{formatPrice(selectedCustomer.total_spent)} تومان</strong>
                </div>
                <div className="info-row">
                  <span>سفارش لغو شده:</span>
                  <strong className={selectedCustomer.cancelled_count >= 3 ? 'cancelled-emphasis' : ''}>
                    {formatPrice(selectedCustomer.cancelled_count)}
                  </strong>
                </div>
                <div className="info-row">
                  <span>آخرین سفارش:</span>
                  <strong>{timeAgo(selectedCustomer.last_order_at)}</strong>
                </div>
              </div>

              <div className="info-card" style={{ marginTop: '16px' }}>
                <h3>🏷️ تگ‌ها</h3>
                <div className="customer-preset-tags">
                  {PRESET_TAGS.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      className={`preset-tag-btn ${editTags.includes(tag.label) ? 'selected' : ''}`}
                      onClick={() => togglePresetTag(tag.key)}
                      disabled={saving}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>

                {editTags.filter((t) => !PRESET_TAGS.some((p) => p.label === t)).length > 0 && (
                  <div className="custom-tags-list">
                    {editTags
                      .filter((t) => !PRESET_TAGS.some((p) => p.label === t))
                      .map((tag) => (
                        <span key={tag} className="custom-tag">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} disabled={saving}>
                            ✕
                          </button>
                        </span>
                      ))}
                  </div>
                )}

                <div className="custom-tag-input">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomTag()
                      }
                    }}
                    placeholder="تگ دلخواه..."
                    disabled={saving}
                  />
                  <button type="button" onClick={addCustomTag} disabled={saving || !newTagInput.trim()}>
                    + افزودن
                  </button>
                </div>
              </div>

              <div className="info-card" style={{ marginTop: '16px' }}>
                <h3>📝 یادداشت</h3>
                <textarea
                  className="customer-notes-input"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="یادداشت شخصی درباره این مشتری..."
                  rows={4}
                  disabled={saving}
                />
              </div>

              {saveMessage && (
                <div className={saveMessage.startsWith('✅') ? 'admin-message' : 'admin-error'} style={{ marginTop: '12px' }}>
                  {saveMessage}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setSelectedCustomer(null)} disabled={saving}>
                بستن
              </button>
              <button type="button" className="btn primary-btn" onClick={saveCustomer} disabled={saving}>
                {saving ? '...' : '💾 ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}