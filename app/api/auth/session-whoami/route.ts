import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۵ — هویت واقعی نشست، بدون شرط پروفایل اپراتوری:
// صفحهٔ ورود بعد از signIn این را صدا می‌زند و ایمیل نشست را با ایمیل تایپ‌شده
// مقایسه می‌کند — اگر کوکی قدیمیِ کاربر دیگری در مرورگر مانده باشد، همین‌جا
// لو می‌رود و پاک می‌شود (خوددرمانی، نه ورود به پنلِ شخص دیگر).
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const store = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll()
      },
      setAll() {},
    },
  })
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) {
    return NextResponse.json({ authed: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json(
    { authed: true, email: (user.email || '').toLowerCase(), userId: user.id },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
