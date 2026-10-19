import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function supabaseServer() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('Supabase environment variables are missing')
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(
        cookiesToSet: Array<{
          name: string
          value: string
          options?: Record<string, unknown>
        }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as never)
          )
        } catch {}
      },
    },
  })
}

// ✅ کلاینت سرور با دسترسی کامل (RLS رو دور می‌زنه)
// برای APIهای حساس (سفارش‌ها، کوپن‌ها، CRM، آمار، ...) استفاده شود.
// هرگز این تابع رو در Client Component صدا نزن!
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase admin env variables are missing')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}