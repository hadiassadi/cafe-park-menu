// lib/menu-types.ts
// فقط تایپ و مقدار پیش‌فرض؛ عمداً چیزی از supabase اینجا import نشده
// تا وارد باندل کلاینت نشود.

export type Category = {
  id: string
  name: string
  icon: string | null
  sort_order: number
  coupon_eligible?: boolean  // ✅ جدید: آیا این دسته شامل تخفیف می‌شه
}

/* ---------- واریانت‌ها ---------- */

export type VariantOption = {
  id: string
  group_id: string
  name: string
  price_modifier: number
  is_default: boolean
  is_available: boolean
  sort_order: number
}

export type VariantGroup = {
  id: string
  product_id: string
  name: string
  is_required: boolean
  sort_order: number
  variant_options: VariantOption[]
}

export type Product = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  size: string | null
  image_url: string | null
  is_featured: boolean
  sort_order: number
  is_available: boolean
  is_new: boolean
  calories: number | null
  prep_time_minutes: number | null
  ingredients: string | null
  allergens: string | null
  dietary_info: string | null
  variant_groups: VariantGroup[]
  // ✅ جدید: تنظیم تخفیف محصول
  // null   = از دسته‌بندی ارث ببر
  // true   = همیشه شامل تخفیف
  // false  = هرگز شامل تخفیف
  coupon_eligible?: boolean | null
  // هزینهٔ بیرون‌بر هر عدد (حل‌شده در سرور). null = بیرون‌بر ندارد
  takeaway_fee?: number | null
  takeaway_label?: string | null

}

export type FontFile = {
  url: string
  family?: string
  weight?: number
  detected_weight?: number
  default_weight?: number
  name?: string
}

export type Theme = {
  primary_color: string
  secondary_color: string
  background_color: string
  surface_color: string
  text_color: string
  muted_text_color: string
  accent_color: string
  font_family: string | null
  font_url: string | null
  font_regular_url: string | null
  font_medium_url: string | null
  font_semibold_url: string | null
  font_bold_url: string | null
  font_extrabold_url: string | null
  font_black_url: string | null
  font_metadata: FontFile[] | null
  border_radius: number
}

export type Settings = {
  cafe_name?: string
  tagline?: string
  hero_title?: string
  hero_subtitle?: string
  footer_text?: string
  address?: string
  phone?: string
  instagram?: string
  working_hours?: string
  logo_url?: string | null
  maps_url?: string | null
  og_title?: string | null
  og_description?: string | null
  og_image_url?: string | null
  og_enabled?: boolean | null
  show_address?: boolean | null
  show_phone?: boolean | null
  show_instagram?: boolean | null
  show_working_hours?: boolean | null
  show_quote?: boolean | null
  show_share_button?: boolean | null
  show_featured_filter?: boolean | null
  show_product_images?: boolean | null
  show_product_size?: boolean | null
  show_footer?: boolean | null
  hero_bg_mode?: string | null
  hero_bg_image_url?: string | null
  hero_overlay?: number | null
  bg_enabled?: boolean | null
  bg_image_url?: string | null
  bg_overlay?: number | null
  contact_header_style?: string | null
  address_in_header?: boolean | null
  address_in_footer?: boolean | null
  address_in_floating?: boolean | null
  phone_in_header?: boolean | null
  phone_in_footer?: boolean | null
  phone_in_floating?: boolean | null
  instagram_in_header?: boolean | null
  instagram_in_footer?: boolean | null
  instagram_in_floating?: boolean | null
  hours_in_header?: boolean | null
  hours_in_footer?: boolean | null
  floating_enabled?: boolean | null
  floating_side?: string | null
  // ✅ جدید
  admin_allow_delete_orders?: boolean | null
}
export type Quote = {
  id: string
  text: string
  author: string | null
}

export type MenuData = {
  categories: Category[]
  products: Product[]
  theme: Partial<Theme> | null
  settings: Settings | null
  quotes: Quote[]
}

export const DEFAULT_THEME: Theme = {
  primary_color: '#6b4f3a',
  secondary_color: '#f3eee7',
  background_color: '#fffdf9',
  surface_color: '#ffffff',
  text_color: '#29251f',
  muted_text_color: '#766f64',
  accent_color: '#9a6b3f',
  font_family: null, // null = فونت وزیرمتن که در layout لود می‌شود
  font_url: null,
  font_regular_url: null,
  font_medium_url: null,
  font_semibold_url: null,
  font_bold_url: null,
  font_extrabold_url: null,
  font_black_url: null,
  font_metadata: null,
  border_radius: 10,
}
// ✅ کوپن تخفیف
export type Coupon = {
  id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_order_amount: number | null  // ✅ جدید: حداکثر مبلغ سفارش
  max_discount: number | null
  max_uses: number | null
  used_count: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}