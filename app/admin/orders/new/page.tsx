import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Category, Product, VariantGroup } from '@/lib/menu-types'
import NewOrderClient from './NewOrderClient'

export const metadata: Metadata = {
  title: 'ثبت سفارش حضوری',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type FeeRow = { id: string; name: string; fee: number }
type PosTableRow = {
  id: string
  number: number
  name: string | null
  location: string | null
}

export default async function NewOrderPage() {
  const db = supabaseAdmin()

  // 🎯 پچ ۵۰-د: میزهای فعال برای انتخاب لمسی
  // 🎯 پچ ۵۰-د-ب: منو (دسته‌ها + محصولات + واریانت‌ها + هزینهٔ بیرون‌بر) هم با
  // service role از سرور خوانده می‌شود — /api/menu با کلاینت کاربر می‌خواند و
  // چون RLS جدول‌ها deny-all است، خالی برمی‌گشت و POS «محصولی پیدا نشد» می‌داد.
  // شکل داده عیناً همان خروجی /api/menu است (فقط منو؛ تم/تنظیمات/جملات لازم نیست).
  const [tablesRes, catsRes, productsRes, variantsRes, feesRes] = await Promise.all([
    db
      .from('tables')
      .select('id, number, name, location, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('number', { ascending: true }),
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
    db
      .from('variant_groups')
      .select(
        `id,product_id,name,is_required,sort_order,
         variant_options(id,group_id,name,price_modifier,is_default,is_available,sort_order)`
      )
      .order('sort_order', { ascending: true }),
    db
      .from('takeaway_fees')
      .select('id,name,fee')
      .eq('is_active', true),
  ])

  // گروه‌بندی واریانت‌ها بر اساس product_id
  const variantGroups = (variantsRes.data ?? []) as VariantGroup[]
  const variantsByProduct = new Map<string, VariantGroup[]>()
  for (const group of variantGroups) {
    const list = variantsByProduct.get(group.product_id) ?? []
    list.push(group)
    variantsByProduct.set(group.product_id, list)
  }

  // هزینهٔ بیرون‌بر: اولویت با گروه خود محصول، بعد گروه دسته
  const feeById = new Map<string, FeeRow>(
    ((feesRes.data ?? []) as FeeRow[]).map((f) => [f.id, f])
  )
  const catFeeId = new Map<string, string | null>(
    ((catsRes.data ?? []) as Array<{ id: string; takeaway_fee_id: string | null }>).map(
      (c) => [c.id, c.takeaway_fee_id ?? null]
    )
  )

  const categories: Category[] = (
    (catsRes.data ?? []) as Array<{ takeaway_fee_id?: string | null } & Category>
  ).map((c) => {
    const { takeaway_fee_id, ...rest } = c
    void takeaway_fee_id
    return rest
  })

  const products: Product[] = (
    (productsRes.data ?? []) as Array<
      { takeaway_fee_id?: string | null; category_id: string; id: string } & Product
    >
  ).map((p) => {
    const { takeaway_fee_id, ...rest } = p
    const feeId = takeaway_fee_id ?? catFeeId.get(p.category_id) ?? null
    const f = feeId ? feeById.get(feeId) : undefined
    return {
      ...rest,
      variant_groups: variantsByProduct.get(p.id) ?? [],
      takeaway_fee: f ? Number(f.fee) : null,
      takeaway_label: f ? f.name : null,
    }
  })

  return (
    <main className="admin">
      <NewOrderClient
        tables={(tablesRes.data ?? []) as PosTableRow[]}
        categories={categories}
        products={products}
      />
    </main>
  )
}
