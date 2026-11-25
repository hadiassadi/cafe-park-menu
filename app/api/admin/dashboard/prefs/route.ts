// app/api/admin/dashboard/prefs/route.ts
// 🎯 پچ ۷۲ — ذخیره/خواندن چیدمان داشبوردِ هر کاربر (جدول dashboard_prefs)
//   GET  → آرایهٔ ویجت‌های ذخیره‌شدهٔ این کاربر (یا پیش‌فرض نقشش)
//   PUT  → ذخیرهٔ انتخاب جدید؛ فقط شناسه‌های مجازِ نقشِ همان کاربر پذیرفته
//          می‌شود (sanitize سمت سرور — کاربر با دستکاری کلاینت نمی‌تواند
//          ویجت مالی را برای خودش فعال کند)
import 'server-only'
import { NextResponse } from 'next/server'
import { getOperatorRole } from '@/lib/admin/roles'
import { canSeeFinanceFor, sanitizeWidgets, defaultWidgetsFor } from '@/lib/admin/dashboard-widgets'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const me = await getOperatorRole()
    if (!me) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const canSeeFinance = canSeeFinanceFor(me.role, me.allowedPaths)

    const db = supabaseAdmin()
    const { data, error } = await db
      .from('dashboard_prefs')
      .select('widgets')
      .eq('user_id', me.userId)
      .maybeSingle()

    if (error) {
      // جدول هنوز ساخته نشده (SQL پچ ۷۲ اجرا نشده) → پیش‌فرض نقش
      console.error('[dashboard prefs] read:', error.message)
      return NextResponse.json(
        {
          widgets: defaultWidgetsFor(me.role, canSeeFinance),
          saved: false,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const widgets = data?.widgets
      ? sanitizeWidgets(data.widgets, me.role, canSeeFinance)
      : defaultWidgetsFor(me.role, canSeeFinance)
    return NextResponse.json(
      { widgets, saved: Boolean(data) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[dashboard prefs] GET unexpected:', err)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const me = await getOperatorRole()
    if (!me) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const canSeeFinance = canSeeFinanceFor(me.role, me.allowedPaths)

    let body: { widgets?: unknown } = {}
    try {
      body = await request.json()
    } catch {}

    const widgets = sanitizeWidgets(body?.widgets, me.role, canSeeFinance)

    const db = supabaseAdmin()
    const { error } = await db
      .from('dashboard_prefs')
      .upsert(
        { user_id: me.userId, widgets, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[dashboard prefs] write:', error.message)
      return NextResponse.json(
        {
          error:
            'ذخیره نشد — اگر جدول تنظیمات ساخته نشده، اول SQL پچ ۷۲ را در Supabase اجرا کن',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, widgets })
  } catch (err) {
    console.error('[dashboard prefs] PUT unexpected:', err)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
