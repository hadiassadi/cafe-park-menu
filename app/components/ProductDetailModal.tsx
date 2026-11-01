'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/lib/menu-types'
import { useCart } from '@/lib/cart-context'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

type Props = {
  product: Product | null
  isOpen: boolean
  onClose: () => void
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
}: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [takeaway, setTakeaway] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { addItem } = useCart()

  // گروه قدیمی «بیرون بر» پنهان می‌شود (هزینهٔ بیرون‌بر اکنون جداگانه است)
  const groups = (product?.variant_groups ?? []).filter(
    (g) => g.name.trim() !== 'بیرون بر'
  )
  const takeawayFee = product?.takeaway_fee ?? null
  const canTakeaway = takeawayFee !== null && takeawayFee > 0
  const isTakeaway = canTakeaway && takeaway
  const takeawayExtra = isTakeaway ? (takeawayFee ?? 0) * 1 : 0

  const hasMultipleGroups = groups.length > 1
  const selectedGroup = groups.find((g) => g.id === selectedGroupId)
  const selectedOption = selectedGroup?.variant_options.find(
    (o) => o.id === selectedOptionId
  )

  // قیمت واحد
  // ✅ اگه گزینه‌ای انتخاب شده، قیمت خودش، قیمت نهایی هست
  // اگه هیچ گزینه‌ای نیست، قیمت پایه محصول
  let unitPrice = product?.price ?? 0
  if (selectedOption) {
    unitPrice = selectedOption.price_modifier
  }
  const totalPrice = (unitPrice + takeawayExtra) * quantity

  // ریست وقتی محصول عوض می‌شه
  useEffect(() => {
    if (!product) return
    setQuantity(1)
    setTakeaway(false)
    setToast(null)

    const gs = (product.variant_groups ?? []).filter(
      (g) => g.name.trim() !== 'بیرون بر'
    )

    if (gs.length === 1) {
      // فقط یه گروه → خودکار انتخابش کن
      setSelectedGroupId(gs[0].id)
      const def =
        gs[0].variant_options.find((o) => o.is_default) ??
        gs[0].variant_options[0]
      setSelectedOptionId(def?.id ?? null)
    } else {
      setSelectedGroupId(null)
      setSelectedOptionId(null)
    }
  }, [product])

  // بستن با Esc
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen || !product) return null

  // ✅ TypeScript را مطمئن می‌کند که product دیگر null نیست
  const currentProduct = product

  const infoItems: Array<{ icon: string; value: string }> = []
  if (currentProduct.calories) {
    infoItems.push({
      icon: '🔥',
      value: `${formatPrice(currentProduct.calories)} کالری`,
    })
  }
  if (currentProduct.prep_time_minutes) {
    infoItems.push({
      icon: '⏱',
      value: `${formatPrice(currentProduct.prep_time_minutes)} دقیقه`,
    })
  }

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId)
    setSelectedOptionId(null) // پاک کن تا کاربر دوباره انتخاب کنه
  }

  function handleAddToCart() {
    if (hasMultipleGroups && !selectedGroupId) {
      setToast('اول نوع سرو رو انتخاب کن')
      setTimeout(() => setToast(null), 2000)
      return
    }
    if (groups.length > 0 && !selectedOptionId) {
      setToast('لطفاً یک گزینه انتخاب کن')
      setTimeout(() => setToast(null), 2000)
      return
    }

    // ✅ افزودن به سبد
    addItem({
      productId: currentProduct.id,
      productName: currentProduct.name,
      productImage: currentProduct.image_url,
      selectedGroupName: selectedGroup?.name ?? null,
      selectedOptionName: selectedOption?.name ?? null,
      selectedOptionId: selectedOption?.id ?? null,
      unitPrice,
      quantity,
            takeaway: isTakeaway,
      takeawayFee: canTakeaway ? (takeawayFee ?? 0) : undefined,
      takeawayLabel: canTakeaway ? (currentProduct.takeaway_label ?? null) : null,
    })


    setToast(`✅ ${currentProduct.name} به سبد اضافه شد`)
    setTimeout(() => {
      setToast(null)
      onClose()
    }, 1200)
  }

  return (
    <div className="product-modal-overlay" onClick={onClose}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        {currentProduct.image_url && (
          <div className="product-modal-image">
            <Image
              src={currentProduct.image_url}
              alt={currentProduct.name}
              fill
              sizes="(max-width: 640px) 100vw, 600px"
              priority
            />
            <button
              type="button"
              className="product-modal-close"
              onClick={onClose}
              aria-label="بستن"
            >
              ✕
            </button>
          </div>
        )}

        <div className="product-modal-body">
          {!currentProduct.image_url && (
            <button
              type="button"
              className="product-modal-close product-modal-close-inline"
              onClick={onClose}
              aria-label="بستن"
            >
              ✕
            </button>
          )}

          <h2 className="product-modal-title">{currentProduct.name}</h2>

          {currentProduct.description && (
            <p className="product-modal-desc">
              {currentProduct.description}
            </p>
          )}

          {infoItems.length > 0 && (
            <div className="product-modal-info-row">
              {infoItems.map((item, i) => (
                <div key={i} className="product-modal-info-pill">
                  <span>{item.icon}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {currentProduct.ingredients && (
            <div className="product-modal-info-box ingredients">
              <div className="product-modal-info-box-title">
                🥗 مواد تشکیل‌دهنده:
              </div>
              <div className="product-modal-info-box-content">
                {currentProduct.ingredients}
              </div>
            </div>
          )}

          {currentProduct.allergens && (
            <div className="product-modal-info-box allergens">
              <div className="product-modal-info-box-title">
                ⚠️ آلرژن‌ها:
              </div>
              <div className="product-modal-info-box-content">
                {currentProduct.allergens}
              </div>
            </div>
          )}

          {currentProduct.dietary_info && (
            <div className="product-modal-info-box dietary">
              <div className="product-modal-info-box-title">
                🌱 اطلاعات رژیمی:
              </div>
              <div className="product-modal-info-box-content">
                {currentProduct.dietary_info}
              </div>
            </div>
          )}

          {/* ۱. نوع سرو */}
          {hasMultipleGroups && (
            <div className="product-modal-step">
              <div className="step-title">نوع سرو</div>
              <div className="service-type-grid">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`service-type-btn ${
                      selectedGroupId === group.id ? 'selected' : ''
                    }`}
                    onClick={() => selectGroup(group.id)}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ۲. سایز / گزینه */}
          {groups.length > 0 &&
            (!hasMultipleGroups || selectedGroupId) &&
            selectedGroup && (
              <div className="product-modal-step">
                <div className="step-title">
                  {hasMultipleGroups ? 'سایز' : selectedGroup.name}
                </div>
                <div className="variant-options-grid">
                  {selectedGroup.variant_options
                    .filter((o) => o.is_available)
                    .map((option) => {
                      const isSelected = selectedOptionId === option.id
                      // ✅ قیمت خودش، نه اضافه‌شده
                      const optionTotal = option.price_modifier
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`variant-option-btn ${
                            isSelected ? 'selected' : ''
                          }`}
                          onClick={() => setSelectedOptionId(option.id)}
                        >
                          <span className="variant-option-name">
                            {option.name}
                          </span>
                          <span className="variant-option-price">
                            {formatPrice(optionTotal)} <small>تومان</small>
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

          {/* ۲.۵ سرو در کافه / بیرون‌بر */}
          {canTakeaway && (
            <div className="product-modal-step">
              <div className="step-title">نوع سرو</div>
              <div className="service-type-grid">
                <button
                  type="button"
                  className={`service-type-btn ${!takeaway ? 'selected' : ''}`}
                  onClick={() => setTakeaway(false)}
                >
                  سرو در کافه
                </button>
                <button
                  type="button"
                  className={`service-type-btn ${takeaway ? 'selected' : ''}`}
                  onClick={() => setTakeaway(true)}
                >
                  🥡 بیرون‌بر (+{formatPrice(takeawayFee ?? 0)} تومان)
                </button>
              </div>
            </div>
          )}

          {/* ۳. تعداد */}

          <div className="product-modal-step">
            <div className="step-title">تعداد</div>
            <div className="quantity-selector">
              <button
                type="button"
                className="qty-btn"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="کم کردن"
              >
                −
              </button>
              <span className="qty-value">{formatPrice(quantity)}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="زیاد کردن"
              >
                +
              </button>
            </div>
          </div>

          {/* قیمت نهایی */}
          <div className="product-modal-total">
            <span>قیمت نهایی:</span>
            <strong>
              {formatPrice(totalPrice)} <small>تومان</small>
            </strong>
          </div>

          {toast && <div className="product-modal-toast">{toast}</div>}

          {/* دکمه‌ها */}
          <div className="product-modal-actions">
            <button
              type="button"
              className="product-modal-btn-cart"
              onClick={handleAddToCart}
            >
              🛒 افزودن به سبد
            </button>
            <button
              type="button"
              className="product-modal-btn-close-secondary"
              onClick={onClose}
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}