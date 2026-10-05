'use client'

import { useEffect, useState } from 'react'
import Modal from '../components/Modal'

type Quote = {
  id: string
  text: string
  author: string | null
  is_active: boolean
  sort_order: number
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)

  // فرم
  const [formText, setFormText] = useState('')
  const [formAuthor, setFormAuthor] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  async function loadQuotes() {
    try {
      const res = await fetch('/api/quotes')
      const data = await res.json()
      setQuotes(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuotes()
  }, [])

  // باز کردن مودال برای افزودن
  function openAddModal() {
    setEditingQuote(null)
    setFormText('')
    setFormAuthor('')
    setFormIsActive(true)
    setMessage(null)
    setIsModalOpen(true)
  }

  // باز کردن مودال برای ویرایش
  function openEditModal(quote: Quote) {
    setEditingQuote(quote)
    setFormText(quote.text)
    setFormAuthor(quote.author ?? '')
    setFormIsActive(quote.is_active)
    setMessage(null)
    setIsModalOpen(true)
  }

  // بستن مودال
  function closeModal() {
    setIsModalOpen(false)
    setEditingQuote(null)
    setFormText('')
    setFormAuthor('')
  }

  // ذخیره (افزودن یا ویرایش)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formText.trim()) return

    setSaving(true)
    setMessage(null)

    try {
      const url = editingQuote
        ? `/api/quotes/${editingQuote.id}`
        : '/api/quotes'

      const method = editingQuote ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: formText,
          author: formAuthor,
          is_active: formIsActive,
          sort_order: editingQuote?.sort_order ?? 0,
        }),
      })

      if (!res.ok) throw new Error('خطا')

      setMessage(editingQuote ? '✅ ویرایش شد' : '✅ جمله اضافه شد')
      await loadQuotes()
      closeModal()
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage('❌ خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  // حذف
  async function handleDelete(id: string) {
    if (!confirm('مطمئنی می‌خوای این جمله رو حذف کنی؟')) return

    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('خطا')

      setMessage('✅ حذف شد')
      await loadQuotes()
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage('❌ خطا در حذف')
    }
  }

  // toggle فعال/غیرفعال
  async function handleToggleActive(quote: Quote) {
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: quote.text,
          author: quote.author ?? '',
          is_active: !quote.is_active,
          sort_order: quote.sort_order,
        }),
      })

      if (!res.ok) throw new Error('خطا')

      await loadQuotes()
    } catch {
      setMessage('❌ خطا در تغییر وضعیت')
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) return <div className="admin">در حال بارگذاری...</div>

  return (
    <div className="admin">
      <div className="admin-header">
        <div>
          <h1>جملات کافه</h1>
          <p className="admin-subtitle">
            جمله‌هایی که توی منو نمایش داده می‌شن ({quotes.length} جمله)
          </p>
        </div>

        <button
          type="button"
          className="btn primary-btn"
          onClick={openAddModal}
        >
          + افزودن جمله
        </button>
      </div>

      {message && (
        <div className="admin-message">{message}</div>
      )}

      {/* لیست جملات */}
      {quotes.length === 0 ? (
        <div className="admin-card">
          <p className="empty-admin">هنوز جمله‌ای اضافه نشده.</p>
        </div>
      ) : (
        <div className="quotes-list">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className={`quote-card ${
                quote.is_active ? '' : 'inactive'
              }`}
            >
              <div className="quote-card-body">
                <div className="quote-card-text">«{quote.text}»</div>
                {quote.author && (
                  <div className="quote-card-author">— {quote.author}</div>
                )}
              </div>

              <div className="quote-card-actions">
                <button
                  type="button"
                  className={`status-toggle ${
                    quote.is_active ? 'active' : 'inactive'
                  }`}
                  onClick={() => handleToggleActive(quote)}
                  title="تغییر وضعیت"
                >
                  {quote.is_active ? '⚡ فعال' : '⭕ غیرفعال'}
                </button>

                <button
                  className="btn"
                  onClick={() => openEditModal(quote)}
                >
                  ✏️ ویرایش
                </button>

                <button
                  className="btn danger"
                  onClick={() => handleDelete(quote.id)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal افزودن/ویرایش */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingQuote ? 'ویرایش جمله' : 'جمله جدید'}
        subtitle={
          editingQuote
            ? 'متن جمله رو ویرایش کن'
            : 'یه جمله جدید برای کافه‌ت بنویس'
        }
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
              form="quote-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving
                ? '...'
                : editingQuote
                  ? 'ذخیره تغییرات'
                  : 'افزودن جمله'}
            </button>
          </>
        }
      >
        <form id="quote-form" onSubmit={handleSave}>
          <div className="field field-wide">
            <label>متن جمله *</label>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="مثلاً: قهوه فقط یه نوشیدنی نیست..."
              rows={4}
              required
              autoFocus
            />
          </div>

          <div className="field field-wide">
            <label>نویسنده (اختیاری)</label>
            <input
              value={formAuthor}
              onChange={(e) => setFormAuthor(e.target.value)}
              placeholder="مثلاً: کافه پارک"
            />
          </div>

          {editingQuote && (
            <label className="check-label" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              <span>این جمله فعال باشد (توی منو نمایش داده شود)</span>
            </label>
          )}
        </form>
      </Modal>
    </div>
  )
}