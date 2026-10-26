import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/require-admin'
import {
  createStepUpToken,
  getStepUpCookieName,
  getStepUpTtlMs,
} from '@/lib/admin/stepup'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // 1) نگهبان ادمین: در حالت رد شدن یک پاسخ برمی‌گرداند، در حالت موفق null
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 })
    }

    const password = String(body?.password || '')
    if (!password) {
      return NextResponse.json({ error: 'رمز عبور الزامی است' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'تنظیمات سرور ناقص است' }, { status: 500 })
    }

    // 2) ایمیل کاربر را از نشست می‌گیریم
    const cookieStore = await cookies()
    const supabaseSession = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    })

    const { data: userData, error: userError } =
      await supabaseSession.auth.getUser()

    const email = userData?.user?.email
    if (userError || !email) {
      return NextResponse.json(
        { error: 'جلسه منقضی شده. دوباره وارد شو.' },
        { status: 401 }
      )
    }

    // 3) بررسی رمز عبور
    const testClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: signInData, error: signInError } =
      await testClient.auth.signInWithPassword({ email, password })

    if (signInError || !signInData?.user) {
      return NextResponse.json({ error: 'رمز عبور اشتباه است' }, { status: 401 })
    }

    // 4) صدور توکن Step-up
    const token = createStepUpToken(email)
    const response = NextResponse.json({ success: true })
    response.cookies.set(getStepUpCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.floor(getStepUpTtlMs() / 1000),
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[stepup] unexpected:', err)
    return NextResponse.json({ error: 'خطای غیرمنتظره' }, { status: 500 })
  }
}
