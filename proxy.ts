import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { accessAllowsPath, sanitizeAllowedPaths } from './lib/admin/modules'
import { OP_ROLES, OpRole } from './lib/admin/role-matrix'

// 🎯 پچ ۵۹-ب/۵۹-ج: دروازهٔ ورود نقش‌ها را می‌شناسد (چک پروفایل با سرویس‌کلید —
// مستقل از RLS؛ اگر سرویس‌کلید نبود، با نشست خود کاربر چک می‌شود)
// 🎯 پچ ۶۰: گیت ماژولار — هر صفحهٔ /admin فقط با ماژولِ تیک‌شده در لیست دلخواه
// کاربر یا پیش‌فرض نقشش باز می‌شود؛ داشبورد همیشه برای همهٔ کاربران پنل باز است

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

    // ─── گارد ادمین: ایمیل‌های env (مالک) یا کاربرانِ ثبت‌شده در جدول نقش‌ها ───
    const allowedAdmins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    const adminEmail = (data.user.email || '').toLowerCase()
    if (!allowedAdmins.includes(adminEmail)) {
      // fail-closed: نه در env باشد و نه پروفایل فعال داشته باشد → ممنوع
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      let prof:
        | {
            role?: string | null
            is_active?: boolean | null
            allowed_paths?: unknown
          }
        | null = null

      if (serviceKey) {
        // 🎯 پچ ۵۹-ج: چک پروفایل با سرویس‌کلید — مستقل از RLS و سیاست‌های جدول
        const adminDb = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: p } = await adminDb
          .from('admin_operator_profiles')
          .select('role, is_active, allowed_paths')
          .eq('user_id', data.user.id)
          .maybeSingle()
        prof = p
      } else {
        // 🎯 پچ ۵۹-ب: بدون سرویس‌کلید — با نشست خود کاربر (نیازمند SQL ۵۹-ب)
        const { data: p } = await supabase
          .from('admin_operator_profiles')
          .select('role, is_active, allowed_paths')
          .eq('user_id', data.user.id)
          .maybeSingle()
        prof = p
      }

      if (!prof || prof.is_active === false) {
        return NextResponse.redirect(
          new URL('/admin/login?denied=1', request.url)
        )
      }

      // 🎯 پچ ۶۰: گیت ماژولار صفحات — لیست دلخواه اگر ثبت شده باشد، وگرنه
      // پیش‌فرض نقش (ماتریس پچ ۵۶). داشبورد در accessAllowsPath همیشه باز است
      const role: OpRole =
        prof.role && OP_ROLES.includes(prof.role as OpRole)
          ? (prof.role as OpRole)
          : 'staff'
      const allowedPaths = sanitizeAllowedPaths(prof.allowed_paths)
      if (!accessAllowsPath(role, allowedPaths, pathname)) {
        return NextResponse.redirect(new URL('/admin', request.url))
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
