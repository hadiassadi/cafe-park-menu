'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { addProduct, updateProduct } from './actions'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'

type VariantOption = {
  id?: string
  name: string
  price_modifier: number
  is_default: boolean
  is_available: boolean
  sort_order: number
}

type VariantGroup = {
  id?: string
  name: string
  is_required: boolean
  sort_order: number
  options: VariantOption[]
}
type TakeawayFee = {
  id: string
  name: string
  fee: number
}


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
  is_available: boolean
  is_new: boolean
  calories: number | null
  prep_time_minutes: number | null
  ingredients: string | null
  allergens: string | null
  dietary_info: string | null
  coupon_eligible: boolean | null
  takeaway_fee_id: string | null
  variant_groups?: VariantGroup[]
}

type ProductsManagerProps = {
  products: Product[]
  categories: Category[]
takeawayFees: TakeawayFee[]
}
export default function ProductsManager({
  products,
  categories,
  takeawayFees,
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
  const [formIsAvailable, setFormIsAvailable] = useState(true)
  const [formIsNew, setFormIsNew] = useState(false)
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null)

  // فیلدهای اضافه
  const [formCalories, setFormCalories] = useState('')
  const [formPrepTime, setFormPrepTime] = useState('')
  const [formIngredients, setFormIngredients] = useState('')
  const [formAllergens, setFormAllergens] = useState('')
  const [formDietaryInfo, setFormDietaryInfo] = useState('')
  const [formTakeawayFeeId, setFormTakeawayFeeId] = useState('')
  // ✅ state کوپن
  const [formCouponEligible, setFormCouponEligible] = useState<
    'inherit' | 'always' | 'never'
  >('inherit')

  // واریانت‌ها
  const [formVariantGroups, setFormVariantGroups] = useState<VariantGroup[]>([])

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products

    return products.filter((product) =>
      product.name.toLowerCase().includes(query)
    )
  }, [products, search])

  function resetForm() {
    setFormCategoryId('')
    setFormName('')
    setFormDescription('')
    setFormPrice('')
    setFormSize('')
    setFormSortOrder('0')
    setFormIsActive(true)
    setFormIsFeatured(false)
    setFormIsAvailable(true)
    setFormIsNew(false)
    setFormImageUrl(null)
    setFormCalories('')
    setFormPrepTime('')
    setFormIngredients('')
    setFormAllergens('')
    setFormDietaryInfo('')
	setFormTakeawayFeeId('')
    setFormCouponEligible('inherit')
    setFormVariantGroups([])
    setMessage(null)
  }

  function openAddModal() {
    setEditingProduct(null)
    resetForm()
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
  setFormIsAvailable(product.is_available)
  setFormIsNew(product.is_new)
  setFormImageUrl(product.image_url)
  setFormCalories(product.calories ? String(product.calories) : '')
  setFormPrepTime(
    product.prep_time_minutes ? String(product.prep_time_minutes) : ''
  )
  setFormIngredients(product.ingredients ?? '')
  setFormAllergens(product.allergens ?? '')
  setFormDietaryInfo(product.dietary_info ?? '')
  setFormTakeawayFeeId(product.takeaway_fee_id ?? '')
  // ✅ مقدار کوپن
  if (product.coupon_eligible === true) {
    setFormCouponEligible('always')
  } else if (product.coupon_eligible === false) {
    setFormCouponEligible('never')
  } else {
    setFormCouponEligible('inherit')
  }

  // ✅ تبدیل variant_options به options
  const groups = (product.variant_groups ?? []).map((g: any) => ({
    name: g.name,
    is_required: g.is_required,
    sort_order: g.sort_order ?? 0,
    options: (g.variant_options ?? g.options ?? []).map((o: any) => ({
      name: o.name,
      price_modifier: o.price_modifier,
      is_default: o.is_default,
      is_available: o.is_available,
      sort_order: o.sort_order ?? 0,
    })),
  }))
  setFormVariantGroups(groups)

  setMessage(null)
  setIsModalOpen(true)
}

  function closeModal() {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  // ==========================
  // عملیات واریانت‌ها
  // ==========================
  function addVariantGroup() {
    setFormVariantGroups([
      ...formVariantGroups,
      {
        name: '',
        is_required: true,
        sort_order: formVariantGroups.length,
        options: [],
      },
    ])
  }

  function updateVariantGroup(
    index: number,
    changes: Partial<VariantGroup>
  ) {
    setFormVariantGroups(
      formVariantGroups.map((g, i) =>
        i === index ? { ...g, ...changes } : g
      )
    )
  }

  function removeVariantGroup(index: number) {
    setFormVariantGroups(
      formVariantGroups.filter((_, i) => i !== index)
    )
  }

  function addVariantOption(groupIndex: number) {
    const groups = [...formVariantGroups]
    groups[groupIndex].options.push({
      name: '',
      price_modifier: 0,
      is_default: groups[groupIndex].options.length === 0,
      is_available: true,
      sort_order: groups[groupIndex].options.length,
    })
    setFormVariantGroups(groups)
  }

  function updateVariantOption(
    groupIndex: number,
    optionIndex: number,
    changes: Partial<VariantOption>
  ) {
    const groups = [...formVariantGroups]
    groups[groupIndex].options[optionIndex] = {
      ...groups[groupIndex].options[optionIndex],
      ...changes,
    }
    setFormVariantGroups(groups)
  }

  function removeVariantOption(
    groupIndex: number,
    optionIndex: number
  ) {
    const groups = [...formVariantGroups]
    groups[groupIndex].options = groups[groupIndex].options.filter(
      (_, i) => i !== optionIndex
    )
    setFormVariantGroups(groups)
  }

  function setDefaultOption(groupIndex: number, optionIndex: number) {
    const groups = [...formVariantGroups]
    groups[groupIndex].options = groups[groupIndex].options.map(
      (opt, i) => ({
        ...opt,
        is_default: i === optionIndex,
      })
    )
    setFormVariantGroups(groups)
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
      if (formIsAvailable) formData.append('is_available', 'on')
      if (formIsNew) formData.append('is_new', 'on')
      if (formImageUrl) formData.append('image_url', formImageUrl)

      if (formCalories) formData.append('calories', formCalories)
      if (formPrepTime)
        formData.append('prep_time_minutes', formPrepTime)
      if (formIngredients)
        formData.append('ingredients', formIngredients)
      if (formAllergens) formData.append('allergens', formAllergens)
      if (formDietaryInfo)
        formData.append('dietary_info', formDietaryInfo)

      // ✅ کوپن
      if (formCouponEligible === 'always') {
        formData.append('coupon_eligible', 'true')
      } else if (formCouponEligible === 'never') {
        formData.append('coupon_eligible', 'false')
      }
      // 'inherit' → هیچ مقداری فرستاده نمی‌شه (null)
// ✅ هزینهٔ بیرون‌بر
if (formTakeawayFeeId) {
  formData.append('takeaway_fee_id', formTakeawayFeeId)
}


      // ✅ واریانت‌ها رو به JSON تبدیل کن
      const validGroups = formVariantGroups.filter(
        (g) => g.name.trim() && g.options.length > 0
      )
      formData.append(
        'variant_groups',
        JSON.stringify(validGroups)
      )

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
                      {product.is_new && (
                        <span className="list-new">جدید</span>
                      )}
                                            {product.coupon_eligible === false && (
                        <span className="list-coupon-off" title="بدون تخفیف">
                          🚫
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="list-col-category">
                    {category?.name ?? 'بدون دسته'}
                  </div>

                  <div className="list-col-price">
                    {new Intl.NumberFormat('fa-IR').format(
                      product.price
                    )}{' '}
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
        title={
          editingProduct ? 'ویرایش محصول' : 'افزودن محصول جدید'
        }
        subtitle={
          editingProduct
            ? editingProduct.name
            : 'اطلاعات محصول رو وارد کن'
        }
        size="lg"
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
          {/* ============ اطلاعات پایه ============ */}
          <div className="form-section-title">
            📋 اطلاعات پایه
          </div>

          <div className="form-grid">
            <div className="field">
              <label>دسته *</label>
              <select
                value={formCategoryId}
                onChange={(e) =>
                  setFormCategoryId(e.target.value)
                }
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
                onChange={(e) =>
                  setFormDescription(e.target.value)
                }
                rows={3}
              />
            </div>

            <div className="field">
              <label>قیمت پایه (تومان) *</label>
              <input
                type="number"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                min="1"
                required
              />
              <small>
                اگه واریانت داره، قیمت **پایه** رو بذار
              </small>
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
          </div>

          {/* ============ اطلاعات اضافه ============ */}
          <div className="form-section-title">
            🍽 اطلاعات تکمیلی
          </div>

          <div className="form-grid">
            <div className="field">
              <label>کالری</label>
              <input
                type="number"
                value={formCalories}
                onChange={(e) => setFormCalories(e.target.value)}
                placeholder="مثلاً 320"
                min="0"
              />
            </div>

            <div className="field">
              <label>زمان آماده‌سازی (دقیقه)</label>
              <input
                type="number"
                value={formPrepTime}
                onChange={(e) => setFormPrepTime(e.target.value)}
                placeholder="مثلاً 10"
                min="0"
              />
            </div>

            <div className="field field-wide">
              <label>مواد تشکیل‌دهنده</label>
              <textarea
                value={formIngredients}
                onChange={(e) =>
                  setFormIngredients(e.target.value)
                }
                rows={2}
                placeholder="مثلاً: آرد، تخم مرغ، شیر، کره"
              />
            </div>

            <div className="field field-wide">
              <label>آلرژن‌ها</label>
              <textarea
                value={formAllergens}
                onChange={(e) =>
                  setFormAllergens(e.target.value)
                }
                rows={2}
                placeholder="مثلاً: گلوتن، شیر، تخم مرغ"
              />
            </div>

            <div className="field field-wide">
              <label>اطلاعات رژیمی</label>
              <input
                type="text"
                value={formDietaryInfo}
                onChange={(e) =>
                  setFormDietaryInfo(e.target.value)
                }
                placeholder="مثلاً: وگان، بدون گلوتن، گیاه‌خوار"
              />
            </div>
          </div>
          {/* ============ تنظیمات تخفیف ============ */}
          <div className="form-section-title">
            🎟️ تنظیمات تخفیف
          </div>

          <div className="coupon-selector">
            <label className="coupon-option">
              <input
                type="radio"
                name="coupon_eligible"
                value="inherit"
                checked={formCouponEligible === 'inherit'}
                onChange={() => setFormCouponEligible('inherit')}
              />
              <div className="coupon-option-content">
                <strong>🔄 از دسته‌بندی ارث ببر</strong>
                <small>
                  اگه دسته‌بندی شامل تخفیف باشه، این محصول هم شامل می‌شه
                </small>
              </div>
            </label>

            <label className="coupon-option">
              <input
                type="radio"
                name="coupon_eligible"
                value="always"
                checked={formCouponEligible === 'always'}
                onChange={() => setFormCouponEligible('always')}
              />
              <div className="coupon-option-content">
                <strong>✅ همیشه شامل تخفیف</strong>
                <small>
                  این محصول همیشه در کمپین‌های تخفیف شرکت می‌کنه (حتی اگه
                  دسته غیرفعال باشه)
                </small>
              </div>
            </label>

            <label className="coupon-option">
              <input
                type="radio"
                name="coupon_eligible"
                value="never"
                checked={formCouponEligible === 'never'}
                onChange={() => setFormCouponEligible('never')}
              />
              <div className="coupon-option-content">
                <strong>🚫 هرگز شامل تخفیف نباشه</strong>
                <small>
                  این محصول هیچ‌وقت تخفیف نمی‌گیره (مثلاً محصولات شرکتی)
                </small>
              </div>
            </label>
          </div>
		  {/* ============ هزینهٔ بیرون‌بر ============ */}
<div className="form-section-title">
  🥡 هزینهٔ بیرون‌بر
</div>

<div className="form-grid">
  <div className="field field-wide">
    <label>گروه هزینه</label>
    <select
      value={formTakeawayFeeId}
      onChange={(e) => setFormTakeawayFeeId(e.target.value)}
    >
      <option value="">از دسته‌بندی ارث ببر</option>
      {takeawayFees.map((fee) => (
        <option key={fee.id} value={fee.id}>
          {fee.name} — {new Intl.NumberFormat('fa-IR').format(fee.fee)} تومان
        </option>
      ))}
    </select>
    <small>
      اگر گروهی انتخاب کنید، به‌جای هزینهٔ دسته برای این محصول اعمال می‌شود.
      اگر دسته هم هزینه نداشته باشد، تیک بیرون‌بر برای این محصول نمایش داده نمی‌شود.
    </small>
  </div>
</div>


          {/* ============ واریانت‌ها ============ */}
          <div className="form-section-title">
            🎛 گزینه‌های انتخابی (واریانت‌ها)
          </div>

          <div className="variants-section">
            {formVariantGroups.length === 0 && (
              <div className="variants-empty">
                هنوز گروهی اضافه نشده. مثلاً «شات» یا «سرو».
              </div>
            )}

            {formVariantGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="variant-group">
                <div className="variant-group-header">
                  <input
                    type="text"
                    className="variant-group-name"
                    value={group.name}
                    onChange={(e) =>
                      updateVariantGroup(groupIndex, {
                        name: e.target.value,
                      })
                    }
                    placeholder="نام گروه (مثلاً: شات)"
                  />

                  <label className="check-label variant-required">
                    <input
                      type="checkbox"
                      checked={group.is_required}
                      onChange={(e) =>
                        updateVariantGroup(groupIndex, {
                          is_required: e.target.checked,
                        })
                      }
                    />
                    <span>اجباری</span>
                  </label>

                  <button
                    type="button"
                    className="btn danger"
                    onClick={() =>
                      removeVariantGroup(groupIndex)
                    }
                    style={{ padding: '6px 10px', fontSize: 11 }}
                  >
                    🗑 حذف گروه
                  </button>
                </div>

                <div className="variant-options">
                  {group.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className="variant-option"
                    >
                      <input
                        type="text"
                        value={option.name}
                        onChange={(e) =>
                          updateVariantOption(
                            groupIndex,
                            optionIndex,
                            { name: e.target.value }
                          )
                        }
                        placeholder="نام (مثلاً: سینگل)"
                      />

                      <input
                        type="number"
                        value={option.price_modifier}
                        onChange={(e) =>
                          updateVariantOption(
                            groupIndex,
                            optionIndex,
                            {
                              price_modifier: Number(
                                e.target.value
                              ),
                            }
                          )
                        }
                        placeholder="+ قیمت"
                      />

                      <label className="check-label">
                        <input
                          type="radio"
                          name={`default-${groupIndex}`}
                          checked={option.is_default}
                          onChange={() =>
                            setDefaultOption(
                              groupIndex,
                              optionIndex
                            )
                          }
                        />
                        <span>پیش‌فرض</span>
                      </label>

                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={option.is_available}
                          onChange={(e) =>
                            updateVariantOption(
                              groupIndex,
                              optionIndex,
                              {
                                is_available:
                                  e.target.checked,
                              }
                            )
                          }
                        />
                        <span>موجود</span>
                      </label>

                      <button
                        type="button"
                        className="btn danger"
                        onClick={() =>
                          removeVariantOption(
                            groupIndex,
                            optionIndex
                          )
                        }
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn"
                    onClick={() => addVariantOption(groupIndex)}
                    style={{ fontSize: 12 }}
                  >
                    + افزودن گزینه
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn primary-btn"
              onClick={addVariantGroup}
              style={{ width: '100%', marginTop: 12 }}
            >
              + افزودن گروه جدید
            </button>
          </div>

          {/* ============ تنظیمات ============ */}
          <div className="form-section-title">
            ⚙️ تنظیمات
          </div>

          <div className="form-grid">
            <div className="field">
              <label>ترتیب نمایش</label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) =>
                  setFormSortOrder(e.target.value)
                }
              />
            </div>
          </div>

          <div className="check-row">
            {editingProduct && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) =>
                    setFormIsActive(e.target.checked)
                  }
                />
                <span>محصول فعال باشد</span>
              </label>
            )}

            <label className="check-label">
              <input
                type="checkbox"
                checked={formIsFeatured}
                onChange={(e) =>
                  setFormIsFeatured(e.target.checked)
                }
              />
              <span>پیشنهاد کافه</span>
            </label>

            <label className="check-label">
              <input
                type="checkbox"
                checked={formIsNew}
                onChange={(e) => setFormIsNew(e.target.checked)}
              />
              <span>محصول جدید</span>
            </label>

            <label className="check-label">
              <input
                type="checkbox"
                checked={formIsAvailable}
                onChange={(e) =>
                  setFormIsAvailable(e.target.checked)
                }
              />
              <span>موجود است</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}