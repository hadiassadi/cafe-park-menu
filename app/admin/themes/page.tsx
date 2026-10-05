import { supabaseServer } from '@/lib/supabase/server'
import ThemesManager from './ThemesManager'

export const dynamic = 'force-dynamic'

export default async function ThemesPage() {
  const db = await supabaseServer()

  const { data: themes, error } = await db
    .from('themes')
    .select('*')
    .order('created_at', {
      ascending: true,
    })

  if (error) {
    return (
      <main className="admin">
        <h1>مدیریت قالب‌ها</h1>

        <p>
          خطا در دریافت قالب‌ها:
          {error.message}
        </p>
      </main>
    )
  }

  return (
    <main className="admin">
      <ThemesManager
        themes={themes ?? []}
      />
    </main>
  )
}