import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import {
  createStepUpToken,
  getStepUpCookieName,
  getStepUpTtlMs,
} from '@/lib/admin/stepup'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const password = String(body?.password || '')

    if (!password) {
      return NextResponse.json(
        { error: 'رمز عبور الزامی است' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!url || !anonKey) {
      return NextResponse.json(
        { error: 'تنظیمات سرور ناقص است' },
        { status: 500 }
      )
    }

    const supabaseSession = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    })

    const { data: userData, error: userError } =
      await supabaseSession.auth.getUser()

    if (userError || !userData?.user?.email) {
      return NextResponse.json(
        { error: 'جلسه منقضی شده. دوباره وارد شو.' },
        { status: 401 }
      )
    }

    const testClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: signInData, error: signInError } =
      await testClient.auth.signInWithPassword({
        email: userData.user.email,
        password,
      })

    if (signInError || !signInData?.user) {
      return NextResponse.json(
        { error: 'رمز عبور اشتباه است' },
        { status: 401 }
      )
    }

    const token = createStepUpToken(userData.user.email)

    const response = NextResponse.json({ success: true })
    response.cookies.set(getStepUpCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.floor(getStepUpTtlMs() / 1000),
      path: '/',
    })

    return response
  } catch (err: any) {
    console.error('[stepup] unexpected:', err)
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}