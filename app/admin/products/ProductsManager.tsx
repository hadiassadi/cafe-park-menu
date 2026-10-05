'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { addProduct, updateProduct } from './actions'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'

type Category = {
  id: string
  name: string
}

type Product = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  size: string | null
  image_url: string | null
  sort_order: number | null
  is_active: boolean
  is_featured: boolean
}

type ProductsManagerProps = {
  products: Product[]
  categories: Category[]
}

export default function ProductsManager({
  products,
  categories,
}: ProductsManagerProps) {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // state فرم
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formSize, setFormSize] = useState('')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formIsFeatured, setFormIsFeatured] = useState(false)
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products

    return products.filter((product) =>
      product.name.toLowerCase().includes(query)
    )
  }, [products, search])

  function openAddModal() {
    setEditingProduct(null)
    setFormCategoryId('')
    setFormName('')
    setFormDescription('')
    setFormPrice('')
    setFormSize('')
    setFormSortOrder('0')
    setFormIsActive(true)
    setFormIsFeatured(false)
    setFormImageUrl(null)
    setMessage(null)
    setIsModalOpen(true)
  }

  function openEditModal(product: Product) {
    setEditingProduct(product)
    setFormCategoryId(product.category_id)
    setFormName(product.name)
    setFormDescription(product.description ?? '')
    setFormPrice(String(product.price))
    setFormSize(product.size ?? '')
    setFormSortOrder(String(product.sort_order ?? 0))
    setFormIsActive(product.is_active)
    setFormIsFeatured(product.is_featured)
    setFormImageUrl(product.image_url)
    setMessage(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const formData = new FormData()
      if (editingProduct) {
        formData.append('id', editingProduct.id)
      }
      formData.append('category_id', formCategoryId)
      formData.append('name', formName)
      formData.append('description', formDescription)
      formData.append('price', formPrice)
      formData.append('size', formSize)
      formData.append('sort_order', formSortOrder)
      if (formIsActive) formData.append('is_active', 'on')
      if (formIsFeatured) formData.append('is_featured', 'on')
      if (formImageUrl) formData.append('image_url', formImageUrl)

      const result = editingProduct
        ? await updateProduct(formData)
        : await addProduct(formData)

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
    <div className="products-manager">
      <div className="products-toolbar">
        <div className="search-box">
          <span>🔍</span>
          <input
            type="search"
            placeholder="جستجوی نام محصول..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn primary-btn"
          onClick={openAddModal}
        >
          + افزودن محصول
        </button>
      </div>

      <section className="products-list-panel">
        <div className="products-list-header">
          <div className="list-col-number">#</div>
          <div className="list-col-product">نام محصول</div>
          <div className="list-col-category">دسته</div>
          <div className="list-col-price">قیمت</div>
          <div className="list-col-status">وضعیت</div>
          <div className="list-col-action">عملیات</div>
        </div>

        <div className="products-list-scroll">
          {filteredProducts.length === 0 ? (
            <div className="products-list-empty">
              محصولی با این نام پیدا نشد.
            </div>
          ) : (
            filteredProducts.map((product, index) => {
              const category = categories.find(
                (item) => item.id === product.category_id
              )

              return (
                <div
                  key={product.id}
                  className="product-list-row"
                >
                  <div className="list-col-number">{index + 1}</div>

                  <div className="list-col-product">
                    <div className="list-product-image">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          width={56}
                          height={56}
                        />
                      ) : (
                        <span>بدون عکس</span>
                      )}
                    </div>

                    <div className="list-product-name">
                      <strong>{product.name}</strong>
                      {product.is_featured && (
                        <span className="list-featured">ویژه</span>
                      )}
                    </div>
                  </div>

                  <div className="list-col-category">
                    {category?.name ?? 'بدون دسته'}
                  </div>

                  <div className="list-col-price">
                    {new Intl.NumberFormat('fa-IR').format(product.price)}{' '}
                    تومان
                  </div>

                  <div className="list-col-status">
                    <span
                      className={
                        product.is_active
                          ? 'status active'
                          : 'status inactive'
                      }
                    >
                      {product.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>

                  <div className="list-col-action">
                    <button
                      type="button"
                      className="btn edit-btn"
                      onClick={() => openEditModal(product)}
                    >
                      ویرایش
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? 'ویرایش محصول' : 'افزودن محصول جدید'}
        subtitle={
          editingProduct
            ? editingProduct.name
            : 'اطلاعات محصول رو وارد کن'
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
              form="product-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving
                ? '...'
                : editingProduct
                  ? 'ذخیره تغییرات'
                  : 'افزودن محصول'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>دسته *</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                required
              >
                <option value="">انتخاب دسته</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>نام محصول *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="field field-wide">
              <label>توضیحات</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="field">
              <label>قیمت (تومان) *</label>
              <input
                type="number"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                min="1"
                required
              />
            </div>

            <div className="field">
              <label>سایز</label>
              <input
                type="text"
                value={formSize}
                onChange={(e) => setFormSize(e.target.value)}
                placeholder="مثلاً 250ml"
              />
            </div>

            <div className="field field-wide">
              <ImageUpload
                value={formImageUrl}
                onChange={setFormImageUrl}
              />
            </div>

            <div className="field">
              <label>ترتیب نمایش</label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
              />
            </div>
          </div>

          <div className="check-row">
            {editingProduct && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <span>محصول فعال باشد</span>
              </label>
            )}

            <label className="check-label">
              <input
                type="checkbox"
                checked={formIsFeatured}
                onChange={(e) => setFormIsFeatured(e.target.checked)}
              />
              <span>محصول ویژه (پیشنهاد کافه)</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}