import 'server-only'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { requireAdminUser } from './require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { OP_ROLES, OpRole } from './role-matrix'
import { accessAllowsPath, sanitizeAllowedPaths } from './modules'

// 🎯 پچ ۵۶ — گاردهای نقش سمت سرور
// 🎯 پچ ۶۰ — پشتیبانی از لیست دلخواه ماژول‌ها (allowed_paths):
//   getOperatorRole: نقش + لیست مجاز کاربر از admin_operator_profiles (پیش‌فرض staff)
//   requirePagePath: گارد صفحات سرور — ریدایرکت به ورود/داشبورد
//   requirePathAccess: گارد API route — NextResponse خطا یا null
//   assertPathAccess: گارد server action — پرتاب خطا

export async function getOperatorRole(): Promise<{
  userId: string
  role: OpRole
  allowedPaths: string[] | null
} | null> {
  const auth = await requireAdminUser()
  if (auth.denied) return null
  const db = supabaseAdmin()
  const { data } = await db
    .from('admin_operator_profiles')
    .select('role, allowed_paths')
    .eq('user_id', auth.userId)
    .maybeSingle()

  // 🎯 پچ ۵۸ — بیمهٔ نقش: کاربرِ ADMIN_EMAILS بدون پروفایل یا با نقش قدیمی
  // (مثل operatorِ پچ ۵۲) هرگز از مالک پایین‌تر نمی‌آید؛ بقیه سخت‌گیرانه staff
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const isEnvAdmin = adminEmails.includes(auth.email || '')

  const role = data?.role as OpRole | undefined
  const finalRole: OpRole =
    role && OP_ROLES.includes(role) ? role : isEnvAdmin ? 'owner' : 'staff'

  // 🎯 پچ ۶۰: لیست دلخواه ماژول‌ها — خالی/null یعنی «پیش‌فرض نقش»
  // (مالک همیشه از accessAllowsPath عبور می‌کند، لیست برایش بی‌اثر است)
  const allowedPaths = sanitizeAllowedPaths(data?.allowed_paths)
  return { userId: auth.userId, role: finalRole, allowedPaths }
}

// گارد صفحات سرور — بدون اجازه: به ورود یا داشبورد می‌رود
export async function requirePagePath(
  path: string
): Promise<{ userId: string; role: OpRole; allowedPaths: string[] | null }> {
  const me = await getOperatorRole()
  if (!me) redirect('/admin/login')
  if (!accessAllowsPath(me.role, me.allowedPaths, path)) redirect('/admin')
  return me
}

// گارد API route — مثل الگوی requireAdmin: پاسخ خطا یا null
export async function requirePathAccess(
  path: string
): Promise<NextResponse | null> {
  const me = await getOperatorRole()
  if (!me)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!accessAllowsPath(me.role, me.allowedPaths, path))
    return NextResponse.json(
      { error: 'دسترسی به این بخش ندارید' },
      { status: 403 }
    )
  return null
}

// گارد server action — پرتاب خطا (actionها خودشان { error } برمی‌گردانند)
export async function assertPathAccess(
  path: string
): Promise<{ userId: string; role: OpRole; allowedPaths: string[] | null }> {
  const me = await getOperatorRole()
  if (!me) throw new Error('Unauthorized')
  if (!accessAllowsPath(me.role, me.allowedPaths, path))
    throw new Error('دسترسی به این بخش ندارید')
  return me
}
