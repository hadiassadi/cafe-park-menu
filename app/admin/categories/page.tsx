import { supabaseServer } from '@/lib/supabase/server'
import CategoriesManager from './CategoriesManager'

export default async function CategoriesPage() {
  const db = await supabaseServer()

  const { data: categories, error } = await db
    .from('categories')
    .select(
      'id,name,icon,description,sort_order,is_active'
    )
    .order('sort_order', { ascending: true })

  if (error) {
    return (
      <main className="admin">
        <h1>مدیریت دسته‌ها</h1>

        <p className="danger">
          خطا در دریافت دسته‌ها: {error.message}
        </p>
      </main>
    )
  }

  return (
    <main className="admin categories-admin">
      <div className="admin-header">
        <div>
          <h1>مدیریت دسته‌ها</h1>

          <p className="admin-subtitle">
            تعداد دسته‌ها: <b>{categories?.length ?? 0}</b>
          </p>
        </div>
      </div>

      <CategoriesManager
        categories={categories ?? []}
      />
    </main>
  )
}