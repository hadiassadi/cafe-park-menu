import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const db = await supabaseServer()

  const [
    catsRes,
    productsRes,
    themeRes,
    settingsRes,
    quotesRes,
    variantsRes,
  ] = await Promise.all([
    db
      .from('categories')
      .select('id,name,icon,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    db
      .from('products')
      .select(
        `id,category_id,name,description,price,size,image_url,
         is_featured,sort_order,is_available,is_new,
         calories,prep_time_minutes,ingredients,allergens,dietary_info`
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    db.from('themes').select('*').eq('is_active', true).maybeSingle(),

    db.from('settings').select('*').eq('id', 1).maybeSingle(),

    db.from('quotes').select('id,text,author').eq('is_active', true),

    db
      .from('variant_groups')
      .select(
        `
        id,product_id,name,is_required,sort_order,
        variant_options(id,group_id,name,price_modifier,is_default,is_available,sort_order)
        `
      )
      .order('sort_order', { ascending: true }),
  ])

  if (catsRes.error || productsRes.error) {
    return NextResponse.json(
      { error: 'خطا در دریافت منو' },
      { status: 500 }
    )
  }

  // ✅ گروه‌بندی واریانت‌ها بر اساس product_id
  const variantGroups = variantsRes.data ?? []
  const variantsByProduct = new Map<
    string,
    typeof variantGroups
  >()
  for (const group of variantGroups) {
    const list = variantsByProduct.get(group.product_id) ?? []
    list.push(group)
    variantsByProduct.set(group.product_id, list)
  }

  // ✅ اضافه کردن واریانت‌ها به هر محصول
  const products = (productsRes.data ?? []).map((p) => ({
    ...p,
    variant_groups: variantsByProduct.get(p.id) ?? [],
  }))

  return NextResponse.json(
    {
      categories: catsRes.data ?? [],
      products,
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