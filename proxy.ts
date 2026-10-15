import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── صفحه لاگین: استثنا ───
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // ─── همه مسیرهای /admin محافظت شده ───
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next()

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

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}