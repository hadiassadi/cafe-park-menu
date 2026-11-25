// app/api/admin/dashboard/prefs/route.ts
// 🎯 پچ ۷۲ — ذخیره/خواندن چیدمان داشبوردِ هر کاربر (جدول dashboard_prefs)
//   GET  → آرایهٔ ویجت‌های ذخیره‌شدهٔ این کاربر (یا پیش‌فرض نقشش) + وضعیت قفل
//   PUT  → ذخیرهٔ انتخاب جدید؛ فقط شناسه‌های مجازِ نقشِ همان کاربر پذیرفته
//          می‌شود (sanitize سمت سرور — کاربر با دستکاری کلاینت نمی‌تواند
//          ویجت مالی را برای خودش فعال کند)
// 🎯 پچ ۷۴ — فیلد locked (قفل چیدمان) + رفتار merge:
//   اگر PUT فقط locked بفرستد، widgets فعلیِ ذخیره‌شده دست‌نخورده می‌ماند
//   (قفل‌کردن هرگز چیدمان را صفر نمی‌کند) و برعکس. مقدار نامعتبر → نادیده.
import 'server-only'
import { NextResponse } from 'next/server'
import { getOperatorRole } from '@/lib/admin/roles'
import { canSeeFinanceFor, sanitizeWidgets, defaultWidgetsFor } from '@/lib/admin/dashboard-widgets'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PrefsRow = { widgets?: unknown; locked?: boolean | null }

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
      .select('widgets, locked')
      .eq('user_id', me.userId)
      .maybeSingle()

    if (error) {
      // جدول هنوز ساخته نشده (SQL پچ ۷۲ اجرا نشده) → پیش‌فرض نقش
      console.error('[dashboard prefs] read:', error.message)
      return NextResponse.json(
        {
          widgets: defaultWidgetsFor(me.role, canSeeFinance),
          locked: false,
          saved: false,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const row = (data ?? null) as PrefsRow | null
    const widgets = row?.widgets
      ? sanitizeWidgets(row.widgets, me.role, canSeeFinance)
      : defaultWidgetsFor(me.role, canSeeFinance)
    return NextResponse.json(
      { widgets, locked: row?.locked === true, saved: Boolean(row) },
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

    let body: { widgets?: unknown; locked?: unknown } = {}
    try {
      body = await request.json()
    } catch {}

    const db = supabaseAdmin()

    // پچ ۷۴: وضعیت فعلی را بخوان تا فیلدِ ارسال‌نشده از دست نرود
    const { data: cur } = await db
      .from('dashboard_prefs')
      .select('widgets, locked')
      .eq('user_id', me.userId)
      .maybeSingle()
    const curRow = (cur ?? null) as PrefsRow | null

    // widgets: اگر آرایهٔ معتبر آمد پالایش و ذخیره؛ وگرنه مقدار فعلی حفظ شود
    const widgets = Array.isArray(body?.widgets)
      ? sanitizeWidgets(body.widgets, me.role, canSeeFinance)
      : curRow?.widgets
        ? sanitizeWidgets(curRow.widgets, me.role, canSeeFinance)
        : defaultWidgetsFor(me.role, canSeeFinance)

    // locked: فقط boolean واقعی پذیرفته می‌شود؛ وگرنه مقدار فعلی حفظ شود
    const locked =
      typeof body?.locked === 'boolean'
        ? body.locked
        : curRow?.locked === true

    const { error } = await db
      .from('dashboard_prefs')
      .upsert(
        {
          user_id: me.userId,
          widgets,
          locked,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[dashboard prefs] write:', error.message)
      return NextResponse.json(
        {
          error:
            'ذخیره نشد — اگر جدول تنظیمات ساخته نشده، اول SQL پچ ۷۲ را (و برای قفل، SQL پچ ۷۴ را) در Supabase اجرا کن',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, widgets, locked })
  } catch (err) {
    console.error('[dashboard prefs] PUT unexpected:', err)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
