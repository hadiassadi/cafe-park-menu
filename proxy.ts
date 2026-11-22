import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next()

  // ─── ۱. ست کردن کوکی دستگاه برای همه کاربران (حتی بدون سفارش) ───
  const deviceToken = request.cookies.get('cafe_device_token')?.value
  if (!deviceToken) {
    // در Edge Runtime، تابع crypto.randomUUID() به صورت سراسری در دسترس است
    const newToken = crypto.randomUUID()
    response.cookies.set('cafe_device_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // ۱ سال
      path: '/',
    })
  }

  // ─── صفحه لاگین: استثنا ───
  if (pathname === '/admin/login') {
    return response
  }

  // ─── همه مسیرهای /admin محافظت شده ───
  if (pathname.startsWith('/admin')) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!url || !key) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string
            value: string
            options?: CookieOptions
          }[]
        ) {
          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }: {
              name: string
              value: string
              options?: CookieOptions
            }) => response.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data } = await supabase.auth.getUser()

    if (!data.user) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // ─── گارد ادمین: فقط ایمیل‌های موجود در ADMIN_EMAILS مجازند ───
    // (قبلاً هر کاربر لاگین‌شده‌ی سوپابیس از اینجا رد می‌شد)
    const allowedAdmins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    const adminEmail = (data.user.email || '').toLowerCase()
    if (!allowedAdmins.includes(adminEmail)) {
      // 🎯 پچ ۵۹-ب: علاوه بر env، کاربرانِ ثبت‌شده در جدول نقش‌ها (پچ ۵۶)
      // هم از دروازهٔ ورود رد می‌شوند — صندوق‌دار/کارمند/مدیرِ ساخته‌شده از
      // پنل قبلاً همین‌جا با ?denied=1 بیرون پرت می‌شد
      // 🎯 پچ ۵۹-ج: چک پروفایل با سرویس‌کلید — مستقل از RLS و سیاست‌های جدول؛
      // اگر سرویس‌کلید در دسترس نبود، با نشست خود کاربر چک می‌شود (نیازمند SQL ۵۹-ب)
      // fail-closed: نه در env باشد و نه پروفایل فعال داشته باشد → ممنوع
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      let panelAllowed = false

      if (serviceKey) {
        const adminDb = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: prof } = await adminDb
          .from('admin_operator_profiles')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle()
        panelAllowed = !!prof
      } else {
        const { data: prof } = await supabase
          .from('admin_operator_profiles')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle()
        panelAllowed = !!prof
      }

      if (!panelAllowed) {
        return NextResponse.redirect(
          new URL('/admin/login?denied=1', request.url)
        )
      }
    }

    return response
  }

  return response
}

export const config = {
  // اجرای میدل‌ور روی همه صفحات به جز APIها و فایل‌های استاتیک
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)',
  ],
}