import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const db = await supabaseServer()

  const [catsRes, productsRes, themeRes, settingsRes, quotesRes] =
    await Promise.all([
      db
        .from('categories')
        .select('id,name,icon,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),

      db
        .from('products')
        .select(
          'id,category_id,name,description,price,size,image_url,is_featured,sort_order'
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),

      db.from('themes').select('*').eq('is_active', true).maybeSingle(),

      db.from('settings').select('*').eq('id', 1).maybeSingle(),

      db
        .from('quotes')
        .select('id,text,author')
        .eq('is_active', true),
    ])

  if (catsRes.error || productsRes.error) {
    return NextResponse.json(
      { error: 'خطا در دریافت منو' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      categories: catsRes.data ?? [],
      products: productsRes.data ?? [],
      theme: themeRes.data ?? null,
      settings: settingsRes.data ?? null,
      quotes: quotesRes.data ?? [],
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}