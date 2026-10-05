import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = await supabaseServer()

  const [
    categoriesRes,
    productsRes,
    quotesRes,
    themesRes,
    recentProductsRes,
  ] = await Promise.all([
    db
      .from('categories')
      .select('id', { count: 'exact', head: true }),

    db
      .from('products')
      .select('id, is_active, is_featured'),

    db
      .from('quotes')
      .select('id', { count: 'exact', head: true }),

    db
      .from('themes')
      .select('id', { count: 'exact', head: true }),

    db
      .from('products')
      .select('id, name, price, image_url, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const products = productsRes.data ?? []
  const activeProducts = products.filter((p) => p.is_active).length
  const featuredProducts = products.filter((p) => p.is_featured).length

  return NextResponse.json({
    categories: categoriesRes.count ?? 0,
    products: products.length,
    activeProducts,
    featuredProducts,
    quotes: quotesRes.count ?? 0,
    themes: themesRes.count ?? 0,
    recentProducts: recentProductsRes.data ?? [],
  })
}