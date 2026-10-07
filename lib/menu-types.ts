// lib/menu-types.ts
// فقط تایپ و مقدار پیش‌فرض؛ عمداً چیزی از supabase اینجا import نشده
// تا وارد باندل کلاینت نشود.

export type Category = {
  id: string
  name: string
  icon: string | null
  sort_order: number
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
