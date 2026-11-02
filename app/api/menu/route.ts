import { NextResponse } from 'next/server'
import 'server-only'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// فقط ستون‌های عمومی تنظیمات (هم‌خوان با lib/menu.ts)
// ستون‌های پرداخت، کلید درگاه و تنظیمات داخلی عمداً اینجا نیستند.
const PUBLIC_SETTINGS_COLUMNS = [
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

export async function GET() {
  const db = await supabaseServer()
  const adminDb = supabaseAdmin()

  const [
    catsRes,
    productsRes,
    themeRes,
    settingsRes,
    quotesRes,
    variantsRes,
    feesRes,
  ] = await Promise.all([
    db
      .from('categories')
      .select('id,name,icon,sort_order,takeaway_fee_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    db
      .from('products')
      .select(
        `id,category_id,name,description,price,size,image_url,
         is_featured,sort_order,is_available,is_new,
         calories,prep_time_minutes,ingredients,allergens,dietary_info,
         takeaway_fee_id`
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    db.from('themes').select('*').eq('is_active', true).maybeSingle(),

    adminDb
      .from('settings')
      .select(PUBLIC_SETTINGS_COLUMNS)
      .eq('id', 1)
      .maybeSingle(),

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

    adminDb
      .from('takeaway_fees')
      .select('id,name,fee')
      .eq('is_active', true),
  ])

  if (catsRes.error || productsRes.error) {
    return NextResponse.json(
      { error: 'خطا در دریافت منو' },
      { status: 500 }
    )
  }

  if (settingsRes.error) {
    console.error('[api/menu] settings error:', settingsRes.error)
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

  if (feesRes.error) {
    console.error('[api/menu] takeaway_fees error:', feesRes.error)
  }
  const feeById = new Map(
    (feesRes.data ?? []).map((f) => [
      f.id,
      { name: f.name, fee: Number(f.fee) },
    ])
  )
  const catFeeId = new Map(
    (catsRes.data ?? []).map((c) => [c.id, c.takeaway_fee_id ?? null])
  )

  // ✅ اضافه کردن واریانت‌ها و هزینهٔ بیرون‌بر به هر محصول
  const products = (productsRes.data ?? []).map((p) => {
    const { takeaway_fee_id, ...rest } = p
    const feeId = takeaway_fee_id ?? catFeeId.get(p.category_id) ?? null
    const f = feeId ? feeById.get(feeId) : undefined
    return {
      ...rest,
      variant_groups: variantsByProduct.get(p.id) ?? [],
      takeaway_fee: f ? f.fee : null,
      takeaway_label: f ? f.name : null,
    }
  })

  const categories = (catsRes.data ?? []).map((c) => {
    const { takeaway_fee_id, ...rest } = c
    return rest
  })

  return NextResponse.json(
    {
      categories,
      products,
      theme: themeRes.data ?? null,
      settings:
        (settingsRes.data as unknown as Record<string, unknown> | null) ??
        null,
      quotes: quotesRes.data ?? [],
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
