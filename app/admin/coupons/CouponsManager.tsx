'use client'
import Link from 'next/link'
import { useState } from 'react'
import Modal from '../components/Modal'
import {
  addCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponActive,
} from './actions'

type Coupon = {
  id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_discount: number | null
  max_uses: number | null
  used_count: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
}

type Props = {
  coupons: Coupon[]
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

// تبدیل ISO به datetime-local format
function toDateTimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

export default function CouponsManager({ coupons }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // فرم
  const [formCode, setFormCode] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDiscountType, setFormDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [formDiscountValue, setFormDiscountValue] = useState('10')
  const [formMinOrder, setFormMinOrder] = useState('0')
  const [formMaxDiscount, setFormMaxDiscount] = useState('')
  const [formMaxUses, setFormMaxUses] = useState('')
  const [formValidFrom, setFormValidFrom] = useState('')
  const [formValidUntil, setFormValidUntil] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  function resetForm() {
    setFormCode('')
    setFormDescription('')
    setFormDiscountType('percent')
    setFormDiscountValue('10')
    setFormMinOrder('0')
    setFormMaxDiscount('')
    setFormMaxUses('')
    setFormValidFrom('')
    setFormValidUntil('')
    setFormIsActive(true)
    setMessage(null)
  }

  function openAddModal() {
    setEditingCoupon(null)
    resetForm()
    setIsModalOpen(true)
  }

  function openEditModal(coupon: Coupon) {
    setEditingCoupon(coupon)
    setFormCode(coupon.code)
    setFormDescription(coupon.description ?? '')
    setFormDiscountType(coupon.discount_type)
    setFormDiscountValue(String(coupon.discount_value))
    setFormMinOrder(String(coupon.min_order_amount))
    setFormMaxDiscount(coupon.max_discount ? String(coupon.max_discount) : '')
    setFormMaxUses(coupon.max_uses ? String(coupon.max_uses) : '')
    setFormValidFrom(toDateTimeLocal(coupon.valid_from))
    setFormValidUntil(toDateTimeLocal(coupon.valid_until))
    setFormIsActive(coupon.is_active)
    setMessage(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingCoupon(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const formData = new FormData()
      if (editingCoupon) formData.append('id', editingCoupon.id)
      formData.append('code', formCode)
      formData.append('description', formDescription)
      formData.append('discount_type', formDiscountType)
      formData.append('discount_value', formDiscountValue)
      formData.append('min_order_amount', formMinOrder)
      if (formMaxDiscount) formData.append('max_discount', formMaxDiscount)
      if (formMaxUses) formData.append('max_uses', formMaxUses)
      if (formValidFrom) formData.append('valid_from', new Date(formValidFrom).toISOString())
      if (formValidUntil) formData.append('valid_until', new Date(formValidUntil).toISOString())
      if (formIsActive) formData.append('is_active', 'on')

      const result = editingCoupon
        ? await updateCoupon(formData)
        : await addCoupon(formData)

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

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`مطمئنی می‌خوای کد «${coupon.code}» رو حذف کنی؟`)) return

    const formData = new FormData()
    formData.append('id', coupon.id)

    const result = await deleteCoupon(formData)
    if (result?.error) {
      alert('❌ ' + result.error)
      return
    }
    window.location.reload()
  }

  async function handleToggleActive(coupon: Coupon) {
    const formData = new FormData()
    formData.append('id', coupon.id)
    formData.append('is_active', coupon.is_active ? 'false' : 'true')

    const result = await toggleCouponActive(formData)
    if (result?.error) {
      alert('❌ ' + result.error)
      return
    }
    window.location.reload()
  }

  function getStatusBadge(coupon: Coupon) {
    const now = new Date()

    if (!coupon.is_active) {
      return <span className="coupon-badge inactive">غیرفعال</span>
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return <span className="coupon-badge expired">منقضی</span>
    }
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return <span className="coupon-badge pending">فعال‌نشده</span>
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return <span className="coupon-badge used-up">ظرفیت پر</span>
    }
    return <span className="coupon-badge active">فعال</span>
  }

  return (
    <div className="admin-main">
      <div className="admin-header">
        <div>
          <h1>🎟️ کدهای تخفیف</h1>
          <p className="admin-subtitle">
            {coupons.length === 0
              ? 'هنوز کد تخفیفی ساخته نشده'
              : `${formatPrice(coupons.length)} کد تخفیف`}
          </p>
        </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            href="/admin/coupons/reports"
            className="btn"
          >
            📊 گزارش
          </Link>
          <button
            type="button"
            className="btn primary-btn"
            onClick={openAddModal}
          >
            + کد تخفیف جدید
          </button>
        </div>
      </div>

      {coupons.length === 0 ? (
        <div className="admin-card">
          <p className="empty-admin">
            هنوز کد تخفیفی نساختی. روی «کد تخفیف جدید» بزن.
          </p>
        </div>
      ) : (
        <div className="coupons-grid">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="coupon-card">
              <div className="coupon-header">
                <div className="coupon-code">{coupon.code}</div>
                {getStatusBadge(coupon)}
              </div>

              {coupon.description && (
                <p className="coupon-description">{coupon.description}</p>
              )}

              <div className="coupon-body">
                <div className="coupon-row">
                  <span>💰 تخفیف:</span>
                  <strong>
                    {coupon.discount_type === 'percent'
                      ? `${formatPrice(coupon.discount_value)}٪`
                      : `${formatPrice(coupon.discount_value)} تومان`}
                  </strong>
                </div>

                {coupon.min_order_amount > 0 && (
                  <div className="coupon-row">
                    <span>📊 حداقل سفارش:</span>
                    <strong>{formatPrice(coupon.min_order_amount)} تومان</strong>
                  </div>
                )}

                {coupon.max_discount && (
                  <div className="coupon-row">
                    <span>🎯 حداکثر تخفیف:</span>
                    <strong>{formatPrice(coupon.max_discount)} تومان</strong>
                  </div>
                )}

                <div className="coupon-row">
                  <span>👥 تعداد استفاده:</span>
                  <strong>
                    {formatPrice(coupon.used_count)}
                    {coupon.max_uses && ` از ${formatPrice(coupon.max_uses)}`}
                  </strong>
                </div>

                {coupon.valid_until && (
                  <div className="coupon-row">
                    <span>⏰ انقضا:</span>
                    <strong>
                      {new Date(coupon.valid_until).toLocaleDateString('fa-IR')}
                    </strong>
                  </div>
                )}
              </div>

              <div className="coupon-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleToggleActive(coupon)}
                >
                  {coupon.is_active ? '🔒 غیرفعال' : '🔓 فعال'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => openEditModal(coupon)}
                >
                  ✏️ ویرایش
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => handleDelete(coupon)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* مودال افزودن/ویرایش */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCoupon ? `ویرایش ${editingCoupon.code}` : 'کد تخفیف جدید'}
        subtitle={
          editingCoupon
            ? 'ویرایش اطلاعات کد تخفیف'
            : 'کد تخفیف جدید بساز'
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
              form="coupon-form"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving ? '...' : editingCoupon ? 'ذخیره' : 'افزودن'}
            </button>
          </>
        }
      >
        <form id="coupon-form" onSubmit={handleSubmit}>
          {message && (
            <div
              className="admin-error"
              style={{ marginBottom: '16px' }}
            >
              {message}
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label>کد تخفیف *</label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="مثلاً WELCOME10"
                required
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
              <small>حروف انگلیسی، بدون فاصله</small>
            </div>

            <div className="field">
              <label>وضعیت</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <span className="switch-track" />
                <span>{formIsActive ? 'فعال' : 'غیرفعال'}</span>
              </label>
            </div>

            <div className="field field-wide">
              <label>توضیحات (اختیاری)</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="مثلاً تخفیف خوش‌آمدگویی"
              />
            </div>

            <div className="field">
              <label>نوع تخفیف</label>
              <select
                value={formDiscountType}
                onChange={(e) =>
                  setFormDiscountType(e.target.value as 'percent' | 'fixed')
                }
              >
                <option value="percent">درصدی (٪)</option>
                <option value="fixed">مبلغ ثابت (تومان)</option>
              </select>
            </div>

            <div className="field">
              <label>
                مقدار تخفیف *
                {formDiscountType === 'percent' ? ' (درصد)' : ' (تومان)'}
              </label>
              <input
                type="number"
                value={formDiscountValue}
                onChange={(e) => setFormDiscountValue(e.target.value)}
                required
                min="1"
                max={formDiscountType === 'percent' ? '100' : undefined}
              />
            </div>

            <div className="field">
              <label>حداقل مبلغ سفارش (اختیاری)</label>
              <input
                type="number"
                value={formMinOrder}
                onChange={(e) => setFormMinOrder(e.target.value)}
                min="0"
                placeholder="0 = بدون محدودیت"
              />
            </div>

            {formDiscountType === 'percent' && (
              <div className="field">
                <label>حداکثر تخفیف (اختیاری)</label>
                <input
                  type="number"
                  value={formMaxDiscount}
                  onChange={(e) => setFormMaxDiscount(e.target.value)}
                  min="0"
                  placeholder="بدون سقف"
                />
              </div>
            )}

            <div className="field">
              <label>حداکثر تعداد استفاده (اختیاری)</label>
              <input
                type="number"
                value={formMaxUses}
                onChange={(e) => setFormMaxUses(e.target.value)}
                min="1"
                placeholder="نامحدود"
              />
            </div>

            <div className="field">
              <label>تاریخ شروع (اختیاری)</label>
              <input
                type="datetime-local"
                value={formValidFrom}
                onChange={(e) => setFormValidFrom(e.target.value)}
              />
              <small>خالی = از الان</small>
            </div>

            <div className="field">
              <label>تاریخ انقضا (اختیاری)</label>
              <input
                type="datetime-local"
                value={formValidUntil}
                onChange={(e) => setFormValidUntil(e.target.value)}
              />
              <small>خالی = بدون انقضا</small>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}