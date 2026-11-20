import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import UsersClient, {
  PanelUser,
  StaffRow,
} from '@/app/admin/components/UsersClient'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۵ — فاز ۴-الف: «کاربران و دسترسی» — این صفحه برخلاف بقیه صفحات پنل
// گارد سمت سرور دارد (نمونهٔ الگوی فاز ۴-ب برای سایر صفحات):
// کارکنان کافه از staff_members + کاربران پنل از auth (سرویس‌کلید) + نقش‌ها از
// admin_operator_profiles

export default async function UsersPage() {
  const auth = await requireAdminUser()
  if (auth.denied) redirect('/admin/login')

  const db = supabaseAdmin()
  const [staffRes, profRes] = await Promise.all([
    db
      .from('staff_members')
      .select(
        'id, full_name, role, phone, is_active, note, created_at'
      )
      .order('is_active', { ascending: false })
      .order('id', { ascending: true }),
    db
      .from('admin_operator_profiles')
      .select('user_id, display_name, role, shift_start_time, shift_end_time'),
  ])

  // کاربران پنل از Supabase auth — فقط برای ادمینِ واردشده، با سرویس‌کلید
  type AuthUserLite = {
    id: string
    email: string
    last_sign_in: string | null
  }
  let authUsers: AuthUserLite[] = []
  try {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 })
    authUsers = (list?.users ?? []).map((u: any) => ({
      id: String(u.id),
      email: String(u.email ?? ''),
      last_sign_in: (u.last_sign_in_at as string) ?? null,
    }))
  } catch (err) {
    console.error('[users page] listUsers:', err)
  }

  const profByUser = new Map(
    (profRes.data ?? []).map((p: any) => [p.user_id as string, p])
  )

  const panelUsers: PanelUser[] = authUsers.map((u) => {
    const p = profByUser.get(u.id)
    return {
      user_id: u.id,
      email: u.email,
      display_name: p?.display_name?.trim() || u.email.split('@')[0],
      role: p?.role ?? 'staff',
      has_profile: !!p,
      shift_start: p?.shift_start_time ?? null,
      shift_end: p?.shift_end_time ?? null,
      last_sign_in: u.last_sign_in,
      is_me: u.id === auth.userId,
    }
  })
  // مالک‌ها اول، بعد بقیه بر اساس ایمیل
  panelUsers.sort(
    (a, b) =>
      (a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1) ||
      a.email.localeCompare(b.email)
  )

  const staff = (staffRes.data ?? []) as unknown as StaffRow[]

  return <UsersClient staff={staff} panelUsers={panelUsers} />
}
