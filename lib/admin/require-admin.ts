import 'server-only'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/server'

export type AdminCheck =
  | { denied: NextResponse; userId?: undefined }
  | { denied: null; userId: string }

export async function requireAdminUser(): Promise<AdminCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return {
      denied: NextResponse.json({ error: 'Server misconfigured' }, { status: 500 }),
    }
  }

  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length === 0) {
    console.warn('[requireAdmin] ADMIN_EMAILS is empty — فقط کاربران با پروفایل اپراتوری وارد می‌شوند')
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {},
    },
  })

  const { data } = await supabase.auth.getUser()
  const user = data.user

  if (!user) {
    return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const email = (user.email || '').toLowerCase()
  if (email && allowed.includes(email)) {
    return { denied: null, userId: user.id }
  }

  // 🎯 پچ ۵۷: کاربری که مالک از صفحهٔ «کاربران و دسترسی» برایش نقش ثبت کرده
  // (پروفایل اپراتوری دارد) مجاز به ورود پنل است — بدون نیاز به ADMIN_EMAILS.
  // مشتریانِ کیف پول (OTP) پروفایل ندارند و همچنان رد می‌شوند.
  const { data: prof } = await supabaseAdmin()
    .from('admin_operator_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!prof) {
    return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { denied: null, userId: user.id }
}

export async function requireAdmin(): Promise<NextResponse | null> {
  const result = await requireAdminUser()
  return result.denied
}
