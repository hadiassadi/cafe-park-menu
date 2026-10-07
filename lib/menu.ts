// lib/menu.ts
// دریافت داده‌های عمومی منو مستقیم از Supabase (سمت سرور).
// این کلاینت cookies نمی‌خواند، پس صفحه می‌تواند استاتیک/ISR بماند.

import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { MenuData, Settings } from './menu-types'

const SETTINGS_COLUMNS = [
  'cafe_name',
  'tagline',
  'hero_title',
  'hero_subtitle',
  'footer_text',
  'address',
  'phone',
  'instagram',
  'working_hours',
  'logo_url',
  'maps_url',
  'og_title',
  'og_description',
  'og_image_url',
  'og_enabled',
  'show_address',
  'show_phone',
  'show_instagram',
  'show_working_hours',
  'show_quote',
  'show_share_button',
  'show_featured_filter',
  'show_product_images',
  'show_product_size',
  'show_footer',
  'hero_bg_mode',
  'hero_bg_image_url',
  'hero_overlay',
  'bg_enabled',
  'bg_image_url',
  'bg_overlay',
  'contact_header_style',
  'address_in_header',
  'address_in_footer',
  'address_in_floating',
  'phone_in_header',
  'phone_in_footer',
  'phone_in_floating',
  'instagram_in_header',
  'instagram_in_footer',
  'instagram_in_floating',
  'hours_in_header',
  'hours_in_footer',
  'floating_enabled',
  'floating_side',
].join(',')

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are missing')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// تنظیمات؛ با cache در یک درخواست فقط یک‌بار از دیتابیس خوانده می‌شود
// (هم برای متای صفحه و هم برای خود منو)
export const getSettings = cache(async (): Promise<Settings | null> => {
  const db = createDb()
  const { data, error } = await db
    .from('settings')
    .select(SETTINGS_COLUMNS)
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    console.error('[menu] settings error:', error)
    return null
  }
  return (data as unknown as Settings | null) ?? null
})

export async function getMenuData(): Promise<MenuData> {
  const db = createDb()

  const [cats, products, theme, settings, quotes] = await Promise.all([
    db
      .from('categories')
      .select('id,name,icon,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),

    db
      .from('products')
      .select(
        'id,category_id,name,description,price,size,image_url,is_featured,sort_order'
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),

    db.from('themes').select('*').eq('is_active', true).limit(1).maybeSingle(),

    getSettings(),

    db.from('quotes').select('id,text,author').eq('is_active', true),
  ])

  // منو بدون دسته‌بندی و محصول بی‌معناست؛ در این حالت خطا بده
  // (در ISR نسخه قبلیِ سالم نگه داشته می‌شود).
  if (cats.error || products.error) {
    console.error('[menu] categories/products error:', cats.error ?? products.error)
    throw new Error('menu fetch failed')
  }

  // بقیه اختیاری‌اند؛ خطایشان را لاگ می‌کنیم ولی صفحه را نمی‌خوابانیم
  if (theme.error) console.error('[menu] theme error:', theme.error)
  if (quotes.error) console.error('[menu] quotes error:', quotes.error)

  return {
    categories: cats.data ?? [],
    products: products.data ?? [],
    theme: theme.data ?? null,
    settings,
    quotes: quotes.data ?? [],
  }
}
