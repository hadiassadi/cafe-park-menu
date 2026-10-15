'use client'

import { useMemo, useState } from 'react'
import { addReason, updateReason, deleteReason, toggleReasonActive } from './actions'
import Modal from '../components/Modal'

type Reason = {
  id: string
  label: string
  target: 'customer' | 'admin' | 'both'
  icon: string | null
  sort_order: number
  is_active: boolean
}

type Props = {
  reasons: Reason[]
}

const TARGET_LABELS: Record<string, string> = {
  customer: '👤 مشتری',
  admin: '🛠️ ادمین',
  both: '👥 هر دو',
}

const TARGET_COLORS: Record<string, string> = {
  customer: 'target-customer',
  admin: 'target-admin',
  both: 'target-both',
}

const ICON_SUGGESTIONS = [
  '🔄', '❌', '⏰', '🔁', '🏪', '✏️', '📦', '🔧',
  '🔥', '⚠️', '💳', '📝', '❓', '🚫', '💤', '👎',
]

export default function CancellationReasonsManager({ reasons }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'customer' | 'admin' | 'both'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReason, setEditingReason] = useState<Reason | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // فرم
  const [formLabel, setFormLabel] = useState('')
  const [formTarget, setFormTarget] = useState<'customer' | 'admin' | 'both'>('both')
  const [formIcon, setFormIcon] = useState('📝')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formIsActive, setFormIsActive] = useState(true)

  const filteredReasons = useMemo(() => {
    let list = reasons
    if (filter !== 'all') {
      list = list.filter((r) => r.target === filter || r.target === 'both')
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => r.label.toLowerCase().includes(q))
    }
    return list.sort((a, b) => a.sort_order - b.sort_order)
  }, [reasons, filter, search])

  function resetForm() {
    setFormLabel('')
    setFormTarget('both')
    setFormIcon('📝')
    setFormSortOrder('0')
    setFormIsActive(true)
    setMessage(null)
  }

  function openAddModal() {
    setEditingReason(null)
    resetForm()
    setIsModalOpen(true)
  }

  function openEditModal(reason: Reason) {
    setEditingReason(reason)
    setFormLabel(reason.label)
    setFormTarget(reason.target)
    setFormIcon(reason.icon || '📝')
    setFormSortOrder(String(reason.sort_order))
    setFormIsActive(reason.is_active)
    setMessage(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingReason(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const formData = new FormData()
      if (editingReason) formData.append('id', editingReason.id)
      formData.append('label', formLabel)
      formData.append('target', formTarget)
      formData.append('icon', formIcon)
      formData.append('sort_order', formSortOrder)
      if (formIsActive) formData.append('is_active', 'on')

      const result = editingReason
        ? await updateReason(formData)
        : await addReason(formData)

      if (result?.error) {
        setMessage('❌ ' + result.error)
        return
      }

      closeModal()
      window.location.reload()
    } catch {
      setMessage('❌ خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(reason: Reason) {
    if (!confirm(`مطمئنی می‌خوای «${reason.label}» رو حذف کنی؟`)) return

    const formData = new FormData()
    formData.append('id', reason.id)

    const result = await deleteReason(formData)
    if (result?.error) {
      alert('❌ ' + result.error)
      return
    }
    window.location.reload()
  }

  async function handleToggleActive(reason: Reason) {
    const formData = new FormData()
    formData.append('id', reason.id)
    formData.append('is_active', reason.is_active ? 'false' : 'true')

    const result = await toggleReasonActive(formData)
    if (result?.error) {
      alert('❌ ' + result.error)
      return
    }
    window.location.reload()
  }

  return (
    <div className="admin-main">
      {/* هدر */}
      <div className="admin-header">
        <div>
          <h1>🚫 دلایل لغو سفارش</h1>
          <p className="admin-subtitle">
            {reasons.length === 0
              ? 'هنوز دلیلی اضافه نشده'
              : `${reasons.length.toLocaleString('fa-IR')} دلیل ثبت شده`}
          </p>
        </div>
        <button
          type="button"
          className="btn primary-btn"
          onClick={openAddModal}
        >
          + دلیل جدید
        </button>
      </div>

      {/* فیلتر + جستجو */}
      <div className="toolbar" style={{ padding: '0 0 16px 0', background: 'transparent', borderBottom: 'none', position: 'static', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          همه
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'customer' ? 'active' : ''}`}
          onClick={() => setFilter('customer')}
        >
          👤 مشتری
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'admin' ? 'active' : ''}`}
          onClick={() => setFilter('admin')}
        >
          🛠️ ادمین
        </button>
      </div>

      <div className="search-box" style={{ marginBottom: '16px' }}>
        <span>🔍</span>
        <input
          type="search"
          placeholder="جستجوی متن دلیل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* لیست دلایل */}
      {filteredReasons.length === 0 ? (
        <div className="admin-card">
          <p className="empty-admin">
            {search.trim()
              ? 'دلیلی با این متن پیدا نشد.'
              : 'هنوز دلیلی اضافه نشده.'}
          </p>
        </div>
      ) : (
        <div className="reasons-grid">
          {filteredReasons.map((reason) => (
            <div key={reason.id} className={`reason-card ${!reason.is_active ? 'inactive' : ''}`}>
              <div className="reason-card-header">
                <div className="reason-icon">{reason.icon || '📝'}</div>
                <div className="reason-info">
                  <strong>{reason.label}</strong>
                  <span className={`reason-target ${TARGET_COLORS[reason.target]}`}>
                    {TARGET_LABELS[reason.target]}
                  </span>
                </div>
                <span className={`reason-status ${reason.is_active ? 'active' : 'inactive'}`}>
                  {reason.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>

              <div className="reason-card-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleToggleActive(reason)}
                >
                  {reason.is_active ? '🔒 غیرفعال' : '🔓 فعال'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => openEditModal(reason)}
                >
                  ✏️ ویرایش
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => handleDelete(reason)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingReason ? 'ویرایش دلیل' : 'دلیل لغو جدید'}
        subtitle={
          editingReason
            ? editingReason.label
            : 'یه دلیل جدید برای لغو سفارش بساز'
        }
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={closeModal}
              disabled={saving}
            >
              انصراف
            </button>
            <button
              type="submit"
              form="reason-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving ? '...' : editingReason ? 'ذخیره' : 'افزودن'}
            </button>
          </>
        }
      >
        <form id="reason-form" onSubmit={handleSubmit}>
          {message && (
            <div className="admin-error" style={{ marginBottom: '16px' }}>
              {message}
            </div>
          )}

          <div className="form-grid">
            <div className="field field-wide">
              <label>متن دلیل *</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="مثلاً: تغییر نظر دادم"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label>برای چه کسی؟</label>
              <select
                value={formTarget}
                onChange={(e) =>
                  setFormTarget(e.target.value as 'customer' | 'admin' | 'both')
                }
              >
                <option value="both">👥 هر دو</option>
                <option value="customer">👤 فقط مشتری</option>
                <option value="admin">🛠️ فقط ادمین</option>
              </select>
            </div>

            <div className="field">
              <label>ترتیب</label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
              />
              <small>عدد کمتر = بالاتر</small>
            </div>

            <div className="field">
              <label>آیکون</label>
              <input
                type="text"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                maxLength={4}
                style={{ fontSize: 20, textAlign: 'center' }}
              />
            </div>

            <div className="field field-wide">
              <label>انتخاب سریع آیکون</label>
              <div className="icon-picker">
                {ICON_SUGGESTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`icon-picker-btn ${
                      formIcon === icon ? 'selected' : ''
                    }`}
                    onClick={() => setFormIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="check-row">
            <label className="check-label">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              <span>این دلیل فعال باشد</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}