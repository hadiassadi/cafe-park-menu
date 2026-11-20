import 'server-only'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { requireAdminUser } from './require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  OP_ROLES,
  OpRole,
  roleAllowsPath,
} from './role-matrix'

// 🎯 پچ ۵۶ — فاز ۴-ب: گاردهای نقش سمت سرور
//   getOperatorRole: نقش کاربر پنل از admin_operator_profiles (پیش‌فرض staff)
//   requirePagePath: گارد صفحات سرور — ریدایرکت به ورود/داشبورد
//   requirePathAccess: گارد API route — NextResponse خطا یا null
//   assertPathAccess: گارد server action — پرتاب خطا

export async function getOperatorRole(): Promise<{
  userId: string
  role: OpRole
} | null> {
  const auth = await requireAdminUser()
  if (auth.denied) return null
  const db = supabaseAdmin()
  const { data } = await db
    .from('admin_operator_profiles')
    .select('role')
    .eq('user_id', auth.userId)
    .maybeSingle()
  const role = data?.role as OpRole | undefined
  if (!role || !OP_ROLES.includes(role)) return { userId: auth.userId, role: 'staff' }
  return { userId: auth.userId, role }
}

// گارد صفحات سرور — بدون اجازه: به ورود یا داشبورد می‌رود
export async function requirePagePath(
  path: string
): Promise<{ userId: string; role: OpRole }> {
  const me = await getOperatorRole()
  if (!me) redirect('/admin/login')
  if (!roleAllowsPath(me.role, path)) redirect('/admin')
  return me
}

// گارد API route — مثل الگوی requireAdmin: پاسخ خطا یا null
export async function requirePathAccess(
  path: string
): Promise<NextResponse | null> {
  const me = await getOperatorRole()
  if (!me)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!roleAllowsPath(me.role, path))
    return NextResponse.json(
      { error: 'دسترسی این بخش فقط برای مالک است' },
      { status: 403 }
    )
  return null
}

// گارد server action — پرتاب خطا (actionها خودشان { error } برمی‌گردانند)
export async function assertPathAccess(
  path: string
): Promise<{ userId: string; role: OpRole }> {
  const me = await getOperatorRole()
  if (!me) throw new Error('Unauthorized')
  if (!roleAllowsPath(me.role, path))
    throw new Error('دسترسی این بخش فقط برای مالک است')
  return me
}
