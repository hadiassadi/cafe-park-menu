// lib/menu.ts
// دریافت داده‌های عمومی منو مستقیم از Supabase (سمت سرور).
// این کلاینت cookies نمی‌خواند، پس صفحه می‌تواند استاتیک/ISR بماند.
//
// ⚠️ اسم متغیرهای محیطی را با پروژه‌ات چک کن. اگر در supabaseServer()
// اسم دیگری استفاده کرده‌ای، همان را اینجا بگذار.

import { createClient } from '@supabase/supabase-js'
import type { MenuData } from './menu-types'

export async function getMenuData(): Promise<MenuData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are missing')
  }

  const db = createClient(url, key, { auth: { persistSession: false } })

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

    // اگر یکی از این ستون‌ها در جدول settings وجود نداشته باشد کوئری خطا می‌دهد
    // (در کنسول لاگ می‌شود). در آن حالت موقتاً select('*') بگذار.
    db
      .from('settings')
      .select(
        'cafe_name,tagline,hero_title,hero_subtitle,footer_text,address,phone,instagram,working_hours'
      )
      .eq('id', 1)
      .maybeSingle(),

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
  if (settings.error) console.error('[menu] settings error:', settings.error)
  if (quotes.error) console.error('[menu] quotes error:', quotes.error)

  return {
    categories: cats.data ?? [],
    products: products.data ?? [],
    theme: theme.data ?? null,
    settings: settings.data ?? null,
    quotes: quotes.data ?? [],
  }
}
