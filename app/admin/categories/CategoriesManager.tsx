'use client'

import { useMemo, useState } from 'react'
import { addCategory, updateCategory } from './actions'
import Modal from '../components/Modal'

type Category = {
  id: string
  name: string
  icon: string | null
  description: string | null
  sort_order: number | null
  is_active: boolean
}

type CategoriesManagerProps = {
  categories: Category[]
}

// ایموجی‌های پرکاربرد برای انتخاب سریع
const ICON_SUGGESTIONS = [
  '☕', '🍵', '🧊', '🥤', '🍰', '🍩', '🍪', '🥐',
  '🍕', '🍔', '🥗', '🍟', '🍦', '🍫', '🍯', '🥛',
  '🍊', '🍋', '🍓', '🥭', '🍉', '🍇', '🍒', '🥥',
  '🌿', '🌸', '⭐', '❤️', '🔥', '✨', '🎁', '🆕',
]

export default function CategoriesManager({
  categories,
}: CategoriesManagerProps) {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // فرم
  const [formName, setFormName] = useState('')
  const [formIcon, setFormIcon] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formIsActive, setFormIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return categories

    return categories.filter((category) =>
      category.name.toLowerCase().includes(query)
    )
  }, [categories, search])

  function openAddModal() {
    setEditingCategory(null)
    setFormName('')
    setFormIcon('')
    setFormDescription('')
    setFormSortOrder('0')
    setFormIsActive(true)
    setMessage(null)
    setIsModalOpen(true)
  }

  function openEditModal(category: Category) {
    setEditingCategory(category)
    setFormName(category.name)
    setFormIcon(category.icon ?? '')
    setFormDescription(category.description ?? '')
    setFormSortOrder(String(category.sort_order ?? 0))
    setFormIsActive(category.is_active)
    setMessage(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const formData = new FormData()
      if (editingCategory) {
        formData.append('id', editingCategory.id)
      }
      formData.append('name', formName)
      formData.append('icon', formIcon)
      formData.append('description', formDescription)
      formData.append('sort_order', formSortOrder)
      if (formIsActive) formData.append('is_active', 'on')

      const result = editingCategory
        ? await updateCategory(formData)
        : await addCategory(formData)

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

  return (
    <div className="categories-manager">
      <div className="categories-toolbar">
        <div className="category-search-box">
          <span>🔍</span>
          <input
            type="search"
            placeholder="جستجوی نام دسته..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn primary-btn"
          onClick={openAddModal}
        >
          + افزودن دسته
        </button>
      </div>

      <section className="categories-list-panel">
        <div className="categories-list-header">
          <div className="category-col-number">#</div>
          <div className="category-col-name">نام دسته</div>
          <div className="category-col-description">توضیحات</div>
          <div className="category-col-order">ترتیب</div>
          <div className="category-col-status">وضعیت</div>
          <div className="category-col-action">عملیات</div>
        </div>

        <div className="categories-list-scroll">
          {filteredCategories.length === 0 ? (
            <div className="categories-list-empty">
              دسته‌ای با این نام پیدا نشد.
            </div>
          ) : (
            filteredCategories.map((category, index) => (
              <div
                key={category.id}
                className="category-list-row"
              >
                <div className="category-col-number">{index + 1}</div>

                <div className="category-col-name">
                  <div className="category-name-wrapper">
                    <div className="category-icon-box">
                      {category.icon || '•'}
                    </div>
                    <strong>{category.name}</strong>
                  </div>
                </div>

                <div className="category-col-description">
                  {category.description ? (
                    <span title={category.description}>
                      {category.description}
                    </span>
                  ) : (
                    <span className="category-no-description">
                      بدون توضیحات
                    </span>
                  )}
                </div>

                <div className="category-col-order">
                  {category.sort_order ?? 0}
                </div>

                <div className="category-col-status">
                  <span
                    className={
                      category.is_active
                        ? 'status active'
                        : 'status inactive'
                    }
                  >
                    {category.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>

                <div className="category-col-action">
                  <button
                    type="button"
                    className="btn edit-btn"
                    onClick={() => openEditModal(category)}
                  >
                    ویرایش
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCategory ? 'ویرایش دسته' : 'افزودن دسته جدید'}
        subtitle={
          editingCategory
            ? editingCategory.name
            : 'یه دسته جدید برای منو بساز'
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
              form="category-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving
                ? '...'
                : editingCategory
                  ? 'ذخیره تغییرات'
                  : 'افزودن دسته'}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>نام دسته *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثلاً قهوه"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label>آیکون (ایموجی)</label>
              <input
                type="text"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="☕"
                maxLength={4}
                style={{ fontSize: 20, textAlign: 'center' }}
              />

              <small className="theme-font-help">
                یه ایموجی انتخاب کن یا از پایین بزن
              </small>
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

            <div className="field field-wide">
              <label>توضیحات</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                placeholder="توضیح کوتاه درباره این دسته"
              />
            </div>

            <div className="field field-wide">
              <label>ترتیب نمایش</label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
              />
              <small className="theme-font-help">
                عدد کمتر = بالاتر توی لیست
              </small>
            </div>
          </div>

          {editingCategory && (
            <div className="check-row">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <span>دسته فعال باشد (توی منو نمایش داده شود)</span>
              </label>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}