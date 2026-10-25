import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

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