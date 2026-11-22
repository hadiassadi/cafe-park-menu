import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePathAccess } from '@/lib/admin/roles'
import {
  ADMIN_MODULES,
  defaultPathsForRole,
  normalizeAllowedPaths,
  sanitizeAllowedPaths,
} from '@/lib/admin/modules'
import { OP_ROLES, OpRole } from '@/lib/admin/role-matrix'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۰ — پشت‌صحنهٔ صفحهٔ «دسترسی ماژول‌ها»:
//   GET: فهرست اپراتورها (+ایمیل از auth) + ماژول‌ها + پیش‌فرض هر نقش
//   POST: ذخیرهٔ لیست دلخواه یک کاربر در admin_operator_profiles.allowed_paths
// مجوز هر دو: requirePathAccess('/admin/access') — پیش‌فرض: مالک و مدیر

type OperatorRow = Record<string, unknown>

export async function GET() {
  const denied = await requirePathAccess('/admin/access')
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
  const denied = await requirePathAccess('/admin/access')
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  if (!userId) {
    return NextResponse.json(
      { error: 'شناسهٔ کاربر نامعتبر است' },
      { status: 400 }
    )
  }

  // فقط مسیرهای شناخته‌شدهٔ رجیستری + داشبورد همیشه داخل لیست
  const allowedPaths = normalizeAllowedPaths(body?.allowedPaths)
  const { error } = await supabaseAdmin()
    .from('admin_operator_profiles')
    .update({ allowed_paths: allowedPaths })
    .eq('user_id', userId)

  if (error) {
    console.error('[access] POST update:', error)
    return NextResponse.json(
      { error: 'ذخیرهٔ دسترسی‌ها انجام نشد' },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, allowed_paths: allowedPaths })
}
