import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getOperatorRole, requirePathAccess } from '@/lib/admin/roles'
import {
  ADMIN_MODULES,
  accessAllowsPath,
  defaultPathsForRole,
  normalizeAllowedPaths,
  sanitizeAllowedPaths,
} from '@/lib/admin/modules'
import { OP_ROLES, OpRole } from '@/lib/admin/role-matrix'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۰ — پشت‌صحنهٔ مدیریت دسترسی ماژول‌ها:
//   GET: فهرست اپراتورها (+ایمیل از auth) + ماژول‌ها + پیش‌فرض هر نقش
//   POST: ذخیرهٔ لیست دلخواه (allowed_paths) و — از ۶۰-ج — تغییر نقش
// 🎯 پچ ۶۳ — ادغام در «کاربران و دسترسی»: مجوز این API از '/admin/access'
// به '/admin/users' تغییر کرد — یعنی تیکِ «کاربران و دسترسی» هم اجازهٔ
// مدیریت تیک‌ها می‌دهد. تغییر نقش همچنان فقط با مالک.

type OperatorRow = Record<string, unknown>

export async function GET() {
  const denied = await requirePathAccess('/admin/users')
  if (denied) return denied

  const db = supabaseAdmin()
  const { data, error } = await db.from('admin_operator_profiles').select('*')
  if (error) {
    console.error('[access] GET profiles:', error)
    return NextResponse.json(
      { error: 'خطا در خواندن کاربران' },
      { status: 500 }
    )
  }

  // ایمیل‌ها از Supabase auth — مثل صفحهٔ کاربران و دسترسی
  const emailById = new Map<string, string>()
  try {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 })
    for (const u of list?.users ?? []) {
      emailById.set(String(u.id), String(u.email ?? ''))
    }
  } catch (err) {
    console.error('[access] listUsers:', err)
  }

  const operators = ((data as OperatorRow[] | null) ?? []).map((op) => {
    const role: OpRole = OP_ROLES.includes(op.role as OpRole)
      ? (op.role as OpRole)
      : 'staff'
    return {
      user_id: String(op.user_id ?? ''),
      email: emailById.get(String(op.user_id ?? '')) ?? '',
      display_name: String(op.display_name ?? ''),
      role,
      is_active: op.is_active !== false,
      allowed_paths: sanitizeAllowedPaths(op.allowed_paths),
      default_paths: defaultPathsForRole(role),
    }
  })

  return NextResponse.json(
    { operators, modules: ADMIN_MODULES },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  // 🎯 پچ ۶۰-ج: تغییرِ نقش فقط برای مالک
  // 🎯 پچ ۶۳: مجوز از '/admin/users' — هماهنگ با ادغام صفحه‌ها
  const me = await getOperatorRole()
  if (!me)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!accessAllowsPath(me.role, me.allowedPaths, '/admin/users'))
    return NextResponse.json(
      { error: 'دسترسی به این بخش ندارید' },
      { status: 403 }
    )

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  if (!userId) {
    return NextResponse.json(
      { error: 'شناسهٔ کاربر نامعتبر است' },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}

  // لیست دلخواه — فقط مسیرهای شناخته‌شدهٔ رجیستری
  // 🎯 پچ ۶۳: داشبورد دیگر اجباری نیست؛ لیست خالی یعنی «پیش‌فرض نقش»
  if (Array.isArray(body?.allowedPaths)) {
    updates.allowed_paths = normalizeAllowedPaths(body.allowedPaths)
  }

  // تغییر نقش — فقط مالک
  if (typeof body?.role === 'string' && body.role) {
    if (me.role !== 'owner') {
      return NextResponse.json(
        { error: 'تغییر نقش فقط با مالک ممکن است' },
        { status: 403 }
      )
    }
    if (!OP_ROLES.includes(body.role as OpRole)) {
      return NextResponse.json({ error: 'نقش نامعتبر است' }, { status: 400 })
    }
    updates.role = body.role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'چیزی برای ذخیره ارسال نشده است' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin()
    .from('admin_operator_profiles')
    .update(updates)
    .eq('user_id', userId)

  if (error) {
    console.error('[access] POST update:', error)
    return NextResponse.json(
      { error: 'ذخیرهٔ دسترسی‌ها انجام نشد' },
      { status: 500 }
    )
  }
  return NextResponse.json({
    ok: true,
    allowed_paths: (updates.allowed_paths as string[] | undefined) ?? null,
    role: (updates.role as string | undefined) ?? null,
  })
}
