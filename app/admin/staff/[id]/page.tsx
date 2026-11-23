import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getOperatorRole } from '@/lib/admin/roles'
import { accessAllowsPath } from '@/lib/admin/modules'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۴ — پروفایل تک‌کارمند: اطلاعات پرسنلی + ساعت کاری اعلامی + آمار
// شیفت‌های واقعی (تعداد، مجموع تنخواه، مغایرت‌ها) + ۱۰ شیفت آخر.
// دارندهٔ تیک «پروفایل کارمند» یا «کاربران و دسترسی» همه را می‌بیند؛
// هر کارمندِ دیگر فقط پروفایل خودش را (تطبیق auth_user_id).

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n)

const dt = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(iso))
    : '—'

type ShiftLite = {
  id: string
  opened_at: string
  closed_at: string | null
  opening_float: number | string | null
  counted_cash: number | string | null
  expected_cash: number | string | null
  discrepancy: number | string | null
  approved_by: string | null
}

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staffId = Number(id)
  if (!Number.isFinite(staffId) || !/^\d+$/.test(String(id))) {
    redirect('/admin/staff')
  }

  const me = await getOperatorRole()
  if (!me) redirect('/admin/login')

  const db = supabaseAdmin()
  const { data: staff } = await db
    .from('staff_members')
    .select(
      'id, full_name, role, phone, is_active, note, created_at, auth_user_id'
    )
    .eq('id', staffId)
    .maybeSingle()
  if (!staff) redirect('/admin/staff')

  const canViewAny =
    accessAllowsPath(me.role, me.allowedPaths, '/admin/staff') ||
    accessAllowsPath(me.role, me.allowedPaths, '/admin/users')
  const isSelf = !!staff.auth_user_id && staff.auth_user_id === me.userId
  if (!canViewAny && !isSelf) redirect('/admin')

  // پروفایل اپراتوری — ساعت اعلامی + نقش پنل + کد
  const prof = staff.auth_user_id
    ? (
        await db
          .from('admin_operator_profiles')
          .select(
            'display_name, role, shift_start_time, shift_end_time, is_active, code'
          )
          .eq('user_id', staff.auth_user_id)
          .maybeSingle()
      ).data
    : null

  // آمار شیفت‌های واقعی — بر اساس opened_by
  let shifts: ShiftLite[] = []
  if (staff.auth_user_id) {
    const { data } = await db
      .from('shifts')
      .select(
        'id, opened_at, closed_at, opening_float, counted_cash, expected_cash, discrepancy, approved_by'
      )
      .eq('opened_by', staff.auth_user_id)
      .order('opened_at', { ascending: false })
      .limit(50)
    shifts = (data ?? []) as ShiftLite[]
  }

  const openedCount = shifts.length
  const stillOpen = shifts.filter((s) => !s.closed_at).length
  const closedShifts = shifts.filter((s) => s.closed_at)
  const totalFloat = closedShifts.reduce(
    (a, s) => a + (Number(s.opening_float) || 0),
    0
  )
  const totalDisc = closedShifts.reduce(
    (a, s) =>
      a +
      (s.discrepancy === null || s.discrepancy === undefined
        ? 0
        : Number(s.discrepancy) || 0),
    0
  )
  const discShifts = closedShifts.filter(
    (s) =>
      s.discrepancy !== null &&
      s.discrepancy !== undefined &&
      Number(s.discrepancy) !== 0
  ).length

  const STAT_BOX: CSSProperties = {
    flex: '1 1 45%',
    background: '#f6f1e9',
    borderRadius: 10,
    padding: '10px 12px',
    minWidth: 140,
  }

  return (
    <main className="admin">
      <div className="admin-header">
        <div>
          <h1>👤 پروفایل {staff.full_name}</h1>
          <p className="admin-subtitle">
            ثبت‌شده از {dt(staff.created_at)} ·{' '}
            {staff.is_active ? 'فعال ✅' : 'غیرفعال ⛔'}
            {isSelf && !canViewAny ? ' — (پروفایل خودت)' : ''}
          </p>
        </div>
        {canViewAny && (
          <Link href="/admin/staff" className="btn" style={{ textDecoration: 'none' }}>
            ← همهٔ کارمندان
          </Link>
        )}
      </div>

      {/* مشخصات پرسنلی */}
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>🗂 مشخصات پرسنلی</h2>
        <div style={{ fontSize: 13.5, display: 'grid', gap: 6, color: '#4b443b' }}>
          <div>نام: <strong>{staff.full_name}</strong></div>
          <div>نقش پرسنلی: <strong>{staff.role ?? '—'}</strong></div>
          <div>
            تلفن:{' '}
            {staff.phone ? (
              <strong dir="ltr">{staff.phone}</strong>
            ) : (
              '—'
            )}
          </div>
          <div>
            اکانت پنل: <strong>{staff.auth_user_id ? 'متصل ✅' : 'ندارد ⛔'}</strong>
            {staff.auth_user_id && !prof ? ' (پروفایل پنل ثبت نشده)' : ''}
          </div>
          {prof?.display_name && (
            <div>نام نمایشی در پنل: <strong>{prof.display_name}</strong></div>
          )}
          {prof?.code && <div>کد اپراتور: <strong>{prof.code}</strong></div>}
          <div>
            ساعت کاری اعلامی:{' '}
            <strong>
              {prof?.shift_start_time
                ? `${prof.shift_start_time} تا ${prof.shift_end_time ?? '—'}`
                : 'ثبت نشده (بدون محدودیت)'}
            </strong>
          </div>
          {staff.note && <div>یادداشت: {staff.note}</div>}
        </div>
      </section>

      {/* آمار شیفت‌ها */}
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>📊 آمار شیفت‌ها (۵۰ مورد اخیر)</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div style={STAT_BOX}>
            <div style={{ fontSize: 12, color: '#766f64' }}>کل شیفت‌های باز شده</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(openedCount)}</div>
          </div>
          <div style={STAT_BOX}>
            <div style={{ fontSize: 12, color: '#766f64' }}>الان باز</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(stillOpen)}</div>
          </div>
          <div style={STAT_BOX}>
            <div style={{ fontSize: 12, color: '#766f64' }}>مجموع تنخواه (شیفت‌های بسته)</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(totalFloat)}</div>
          </div>
          <div style={STAT_BOX}>
            <div style={{ fontSize: 12, color: '#766f64' }}>مجموع مغایرت صندوق</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: totalDisc === 0 ? '#2d5d3e' : totalDisc > 0 ? '#9a6b3f' : '#9b3c32',
              }}
            >
              {totalDisc === 0
                ? '۰ — تمیز ✅'
                : `${totalDisc > 0 ? 'مازاد' : 'کسری'} ${fmt(Math.abs(totalDisc))}`}
            </div>
          </div>
          <div style={STAT_BOX}>
            <div style={{ fontSize: 12, color: '#766f64' }}>شیفت با مغایرت غیرصفر</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(discShifts)}</div>
          </div>
        </div>
      </section>

      {/* شیفت‌های اخیر */}
      <section className="admin-card">
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>⏱ شیفت‌های اخیر</h2>
        {shifts.length === 0 && (
          <p className="empty-admin">شیفت‌ای ثبت نشده است{staff.auth_user_id ? '' : ' — این کارمند اکانت پنل ندارد'}.</p>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {shifts.slice(0, 10).map((s) => {
            const isOpen = !s.closed_at
            const disc =
              s.discrepancy === null || s.discrepancy === undefined
                ? null
                : Number(s.discrepancy)
            return (
              <div
                key={s.id}
                style={{
                  fontSize: 12.5,
                  border: '1px solid #eee4d6',
                  borderRadius: 10,
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 6,
                  borderRight: `4px solid ${isOpen ? '#2d5d3e' : s.approved_by ? '#4a7fa5' : '#d9a441'}`,
                }}
              >
                <span>
                  {isOpen ? '🟢 باز' : s.approved_by ? '✅ بسته + تأیید' : '🟡 بسته (در انتظار تأیید)'}
                  {' — '}
                  {dt(s.opened_at)}
                  {!isOpen && ` ← ${dt(s.closed_at)}`}
                </span>
                <span style={{ color: '#766f64' }}>
                  تنخواه {fmt(Number(s.opening_float) || 0)}
                  {!isOpen && s.counted_cash !== null && s.counted_cash !== undefined
                    ? ` · شمارش ${fmt(Number(s.counted_cash))}`
                    : ''}
                  {disc !== null &&
                    ` · ${disc === 0 ? 'بدون مغایرت' : `${disc > 0 ? 'مازاد' : 'کسری'} ${fmt(Math.abs(disc))}`}`}
                </span>
              </div>
            )
          })}
        </div>
        {shifts.length > 10 && (
          <p style={{ fontSize: 12, color: '#766f64', marginTop: 8 }}>
            (۱۰ مورد اخیر از {fmt(shifts.length)} شیفت — جزئیات کامل در «شیفت‌ها»)
          </p>
        )}
      </section>
    </main>
  )
}
