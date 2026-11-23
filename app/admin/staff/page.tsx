import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOperatorRole } from '@/lib/admin/roles'
import { accessAllowsPath } from '@/lib/admin/modules'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۴ — هاب پروفایل کارمندان: دارندهٔ تیک «پروفایل کارمند» یا
// «کاربران و دسترسی» همه را می‌بیند؛ هر کارمندِ دیگر به پروفایل خودش هدایت می‌شود.
export default async function StaffListPage() {
  const me = await getOperatorRole()
  if (!me) redirect('/admin/login')

  const canList =
    accessAllowsPath(me.role, me.allowedPaths, '/admin/staff') ||
    accessAllowsPath(me.role, me.allowedPaths, '/admin/users')

  const db = supabaseAdmin()
  const { data: staffRows } = await db
    .from('staff_members')
    .select('id, full_name, role, phone, is_active, note, auth_user_id')
    .order('is_active', { ascending: false })
    .order('id', { ascending: true })

  // کارمندِ واردشده (بدون تیک) فقط پروفایل خودش را می‌بیند
  const myStaffRow = (staffRows ?? []).find(
    (s: any) => s.auth_user_id === me.userId
  )
  if (!canList) {
    if (myStaffRow) redirect(`/admin/staff/${myStaffRow.id}`)
    redirect('/admin')
  }

  const { data: profs } = await db
    .from('admin_operator_profiles')
    .select(
      'user_id, display_name, role, shift_start_time, shift_end_time, is_active'
    )
  const profByUser = new Map(
    (profs ?? []).map((p: any) => [p.user_id as string, p])
  )

  // 🎯 پچ ۶۵ — ایمیل اکانت‌های متصل در فهرست هم دیده شود (نه فقط «متصل است»)
  let authEmailById = new Map<string, string>()
  try {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 })
    authEmailById = new Map(
      (list?.users ?? []).map((u: any) => [String(u.id), String(u.email ?? '')])
    )
  } catch (err) {
    console.error('[staff list] listUsers:', err)
  }

  return (
    <main className="admin">
      <div className="admin-header">
        <div>
          <h1>🧑‍💼 پروفایل کارمندان</h1>
          <p className="admin-subtitle">
            مشخصات پرسنل، ساعت کاری اعلامی و آمار شیفت‌های واقعی هر نفر — برای
            دیدن جزئیات روی هر کارت بزنید
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {(staffRows ?? []).map((s: any) => {
          const p = s.auth_user_id
            ? profByUser.get(String(s.auth_user_id))
            : null
          return (
            <Link
              key={s.id}
              href={`/admin/staff/${s.id}`}
              className="admin-card"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <strong style={{ fontSize: 14 }}>
                  👤 {s.full_name}
                  {!s.is_active && ' (غیرفعال)'}
                  {p?.role === 'owner'
                    ? ' 👑'
                    : p?.role === 'manager'
                      ? ' 🎖'
                      : ''}
                </strong>
                <span style={{ fontSize: 12, color: '#766f64' }}>
                  {p?.shift_start_time
                    ? `ساعت اعلامی: ${p.shift_start_time} تا ${p.shift_end_time ?? '—'}`
                    : 'بدون ساعت اعلامی'}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: '#766f64', marginTop: 4 }}>
                نقش پرسنلی: {s.role ?? '—'} · تلفن:{' '}
                {s.phone ? <span dir="ltr">{s.phone}</span> : '—'} ·{' '}
                {s.auth_user_id
                  ? authEmailById.get(String(s.auth_user_id))
                    ? `اکانت متصل: ${authEmailById.get(String(s.auth_user_id))}`
                    : 'اکانت دارد، پروفایل پنل ندارد'
                  : 'بدون اکانت پنل'}
              </div>
            </Link>
          )
        })}
        {(staffRows ?? []).length === 0 && (
          <p className="empty-admin">کارمندی ثبت نشده است.</p>
        )}
      </div>
    </main>
  )
}
