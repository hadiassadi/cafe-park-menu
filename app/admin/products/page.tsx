import { supabaseServer } from '@/lib/supabase/server'
import ProductsManager from './ProductsManager'

export default async function ProductsPage() {
  const db = await supabaseServer()

  const productsResult = await db
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })

  const categoriesResult = await db
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })

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
      />
    </main>
  )
}