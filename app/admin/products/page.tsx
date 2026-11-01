import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'محصولات',
  robots: { index: false, follow: false },
}
import { supabaseServer } from '@/lib/supabase/server'
import ProductsManager from './ProductsManager'

export default async function ProductsPage() {
  const db = await supabaseServer()

  const productsResult = await db
  .from('products')
  .select(
    `*,
     variant_groups(
       id, product_id, name, is_required, sort_order,
       variant_options(id, group_id, name, price_modifier, is_default, is_available, sort_order)
     )`
  )
  .order('sort_order', { ascending: true })

  const categoriesResult = await db
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })
const feesResult = await db
  .from('takeaway_fees')
  .select('id, name, fee')
  .eq('is_active', true)
  .order('sort_order', { ascending: true })
const takeawayFees = feesResult.data ?? []



  if (productsResult.error) {
    return (
      <main className="admin">
        <h1>مدیریت محصولات</h1>
        <p className="danger">
          {productsResult.error.message}
        </p>
      </main>
    )
  }

  if (categoriesResult.error) {
    return (
      <main className="admin">
        <h1>مدیریت محصولات</h1>
        <p className="danger">
          {categoriesResult.error.message}
        </p>
      </main>
    )
  }

  const products = productsResult.data ?? []
  const categories = categoriesResult.data ?? []

  return (
    <main className="admin products-admin">
      <div className="admin-header">
        <div>
          <h1>مدیریت محصولات</h1>

          <p className="admin-subtitle">
            تعداد محصولات: <b>{products.length}</b>
          </p>
        </div>
      </div>

      <ProductsManager
        products={products}
        categories={categories}
takeawayFees={takeawayFees}
      />
    </main>
  )
}