import { NextResponse } from 'next/server'
import { getOperatorRole } from '@/lib/admin/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import { APP_BUILD } from '@/lib/version'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۶ — نقش اپراتوری کاربر پنل؛ مبنای فیلتر منو و گارد مسیر در layout
// 🎯 پچ ۶۰ — لیست نهایی ماژول‌های مجاز (paths) برای منوی ماژولار
//   paths = [] یعنی «پیش‌فرض نقش» — layout همان را از ماتریس نقش می‌سازد
// 🎯 پچ ۶۰-د/هـ — email (نشانگر هویت سایدبار) + build (مُهر نسخهٔ دیپلوی)
// 🎯 پچ ۷۲ — name (نام نمایشی برای نوار وضعیت) + lastLogin (آخرین ورود همان
//   شخص از auth — همان منبعی که صفحهٔ کاربران نشان می‌دهد). هر دو با fallback
//   امن: اگر جدول/ستون نبود یا خطا داد، ایمیلِ کاربر جای نام می‌نشیند و
//   lastLogin خالی می‌ماند — هیچ‌وقت پاسخ whoami خراب نمی‌شود.
// 🎯 پچ ۷۳ — نام واقعی: اول staff_members.full_name (auth_user_id + is_active)،
//   بعد display_name پروفایل اپراتوری، بعد full_name متادیتای auth، آخر ایمیل.

export async function GET() {
  try {
    const me = await getOperatorRole()
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 🎯 پچ ۷۲: نام نمایشی + آخرین ورود — خطاها بی‌صدا نادیده گرفته می‌شوند
    let displayName = ''
    let lastLogin: string | null = null
    try {
      const db = supabaseAdmin()

      // 🎯 پچ ۷۳: اولویت ۱ — نام واقعی از staff_members (auth_user_id = کاربر
      // واردشده، فعال) — همان نامی که مالک در صفحهٔ کارکنان ثبت می‌کند
      const { data: staffRow } = await db
        .from('staff_members')
        .select('full_name')
        .eq('auth_user_id', me.userId)
        .eq('is_active', true)
        .maybeSingle()
      if (
        typeof staffRow?.full_name === 'string' &&
        staffRow.full_name.trim()
      ) {
        displayName = staffRow.full_name.trim()
      }

      // اولویت ۲ — نام نمایشی پروفایل اپراتوری (پچ ۷۲)
      if (!displayName) {
        const { data: prof } = await db
          .from('admin_operator_profiles')
          .select('display_name')
          .eq('user_id', me.userId)
          .maybeSingle()
        if (
          typeof prof?.display_name === 'string' &&
          prof.display_name.trim()
        ) {
          displayName = prof.display_name.trim()
        }
      }

      const { data: authUser } = await db.auth.admin.getUserById(me.userId)
      const u = authUser?.user
      // اولویت ۳ — full_name در متادیتای auth
      if (
        !displayName &&
        typeof u?.user_metadata?.full_name === 'string' &&
        u.user_metadata.full_name.trim()
      ) {
        displayName = u.user_metadata.full_name.trim()
      }
      const ls = (u as { last_sign_in_at?: string } | null | undefined)
        ?.last_sign_in_at
      if (typeof ls === 'string' && ls) lastLogin = ls
    } catch (e) {
      console.error('[whoami] profile/last-login enrich skipped:', e)
    }

    // اولویت ۴ — بخش اول ایمیل
    if (!displayName && me.email) {
      displayName = me.email.split('@')[0]
    }

    return NextResponse.json(
      {
        role: me.role,
        paths: me.allowedPaths ?? [],
        email: me.email,
        name: displayName,
        lastLogin,
        build: APP_BUILD,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[whoami] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
