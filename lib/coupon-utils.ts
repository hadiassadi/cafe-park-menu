// lib/coupon-utils.ts
import type { Product, Category } from './menu-types'

/**
 * بررسی می‌کنه که آیا یه محصول شامل تخفیف می‌شه یا نه
 * 
 * منطق:
 * 1. اگه محصول مقدار مشخص داره (true/false) → همون مقدار
 * 2. اگه محصول null هست → از دسته‌بندی ارث می‌بره
 * 3. اگه دسته‌بندی هم مشخص نبود → پیش‌فرض true
 */
export function isCouponEligible(
  product: Pick<Product, 'coupon_eligible'>,
  category?: Pick<Category, 'coupon_eligible'> | null
): boolean {
  // اگه محصول مقدار مشخص داره
  if (product.coupon_eligible === true) return true
  if (product.coupon_eligible === false) return false

  // اگه null بود، از دسته ارث ببر
  if (category) {
    if (category.coupon_eligible === false) return false
    if (category.coupon_eligible === true) return true
  }

  // پیش‌فرض: شامل تخفیف
  return true
}