import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { createClient } from '@supabase/supabase-js'
import { assertAdminId } from '@/lib/admin/assert-admin'
import {
  saveOperatorProfile,
  approveShift,
  forceCloseShift,
} from './actions'

export const metadata: Metadata = {
  title: 'شیفت ها',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۱: گزارش شیفت‌ها — فیلتر اپراتور × وضعیت × بازهٔ تاریخ
// 🎯 پچ ۵۲: گردش کامل شیفت — تایید مدیر (چهارچشم)، تحویل صندوق بین شیفت‌ها،
//            بستن اجباری، حد مغایرت، نام نمایشی و ساعات کاری اپراتورها

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n)
const TOLERANCE = 50_000 // حد مغایرت مجاز (تومان)

const dt = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Asia/Tehran',
      }).format(new Date(iso))
    : '—'

type SP = { operator?: string; state?: string; from?: string; to?: string }

type ShiftTotals = {
  cash: number
  card: number
  online: number
  transfer: number
  orders: number
  open: number
}

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d8d0c4',
  fontFamily: 'inherit',
  fontSize: 13,
  background: '#fff',
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return (
      <main className="admin">
        <h1>شیفت‌ها</h1>
        <p className="danger">تنظیمات سرور ناقص است (Service Role Key وجود ندارد).</p>
      </main>
    )
  }

  let currentUserId: string | null = null
  try {
    currentUserId = await assertAdminId()
  } catch {
    currentUserId = null
  }

  const db = createClient(url, key, { auth: { persistSession: false } })

  // کاربران ادمین + پروفایل اپراتوری (نام نمایشی، کد، ساعات کاری)
  let userRows: any[] = []
  let profilesRows: any[] = []
  try {
    const { data } = await db.auth.admin.listUsers({ perPage: 500 })
    userRows = data?.users ?? []
  } catch (e) {
    console.error('[shifts page] users:', e)
  }
  try {
    const { data } = await db
      .from('admin_operator_profiles')
      .select(
        'user_id, code, display_name, shift_start_time, shift_end_time'
      )
    profilesRows = data ?? []
  } catch (e) {
    console.error('[shifts page] profiles:', e)
  }
  const profileByUser: Record<string, any> = {}
  for (const p of profilesRows) profileByUser[p.user_id] = p
  const users = userRows.map((u: any) => ({
    id: u.id,
    email: u.email ?? null,
    name:
      profileByUser[u.id]?.display_name?.trim() ||
      (typeof u.user_metadata?.full_name === 'string' &&
        u.user_metadata.full_name.trim()) ||
      u.email ||
      'کاربر',
  }))
  const nameById: Record<string, string> = Object.fromEntries(
    users.map((u) => [u.id, u.name])
  )

  // شیفت‌ها با فیلتر
  let q = db
    .from('shifts')
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(300)
  if (sp.operator) q = q.eq('opened_by', sp.operator)
  if (sp.state === 'open') q = q.is('closed_at', null)
  if (sp.state === 'closed') q = q.not('closed_at', 'is', null)
  if (sp.from) q = q.gte('opened_at', `${sp.from}T00:00:00`)
  if (sp.to) q = q.lte('opened_at', `${sp.to}T23:59:59`)
  const { data: shifts, error: shiftsErr } = await q

  // جمع‌های هر شیفت (دفتر پرداخت + سفارش‌ها + سفارش‌های باز)
  const ids = (shifts ?? []).map((s: any) => s.id)
  const totalsByShift: Record<string, ShiftTotals> = {}
  if (ids.length > 0) {
    const [pays, ords] = await Promise.all([
      db
        .from('order_payments')
        .select('shift_id, method, amount')
        .in('shift_id', ids)
        .eq('status', 'confirmed'),
      db
        .from('orders')
        .select('shift_id, status, payment_status')
        .in('shift_id', ids),
    ])
    for (const s of ids) {
      totalsByShift[s] = { cash: 0, card: 0, online: 0, transfer: 0, orders: 0, open: 0 }
    }
    for (const p of pays.data ?? []) {
      const t = totalsByShift[(p as any).shift_id as string]
      if (!t) continue
      const a = Number((p as any).amount) || 0
      const m = (p as any).method
      if (m === 'cash') t.cash += a
      else if (m === 'card') t.card += a
      else if (m === 'online') t.online += a
      else if (m === 'transfer') t.transfer += a
    }
    for (const o of ords.data ?? []) {
      const t = totalsByShift[(o as any).shift_id as string]
      if (!t) continue
      t.orders += 1
      if ((o as any).status !== 'cancelled' && (o as any).payment_status !== 'paid') {
        t.open += 1
      }
    }
  }

  // نام شیفت‌های مبدا تحویل (ممکن است خارج از فیلتر باشند)
  const handoverIds = (shifts ?? [])
    .map((s: any) => s.handover_from_shift_id as string | null)
    .filter((x): x is string => Boolean(x))
  const handoverFromById: Record<string, any> = {}
  if (handoverIds.length > 0) {
    const { data: hrows } = await db
      .from('shifts')
      .select('id, opened_by, opened_by_name')
      .in('id', handoverIds)
    for (const h of hrows ?? []) handoverFromById[h.id] = h
  }

  return (
    <main className="admin">
      <div className="admin-header">
        <div>
          <h1>⏱ شیفت‌ها و عملیات اپراتورها</h1>
          <p className="admin-subtitle">
            هر شیفت = کار یک اپراتور از باز کردن تا بستن — تحویل صندوق با تایید
            گیرنده، گزارش بستن با تایید مدیر (چهارچشم)
          </p>
        </div>
      </div>

      {/* پروفایل اپراتورها: نام نمایشی + کد + ساعات کاری */}
      <section className="admin-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>🏷 اپراتورها</h2>
        <p style={{ fontSize: 12.5, color: '#766f64', margin: '0 0 10px' }}>
          نام نمایشی (به‌جای ایمیل) · کد کوتاه · ساعات کاری مجاز — خارج از بازه،
          باز کردن شیفت ممکن نیست. همه خالی = بدون پروفایل. کد تکراری ذخیره نمی‌شود.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {users.map((u) => {
            const p = profileByUser[u.id]
            return (
              <form
                key={u.id}
                action={saveOperatorProfile}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <input type="hidden" name="user_id" value={u.id} />
                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 180, flex: 1 }}>
                  👤 {u.name}
                  {p?.code ? ` — کد فعلی: ${p.code}` : ''}
                </span>
                <input
                  name="display_name"
                  defaultValue={p?.display_name ?? ''}
                  placeholder="نام نمایشی"
                  style={{ ...inputStyle, width: 130 }}
                />
                <input
                  name="code"
                  defaultValue={p?.code ?? ''}
                  placeholder="کد"
                  style={{ ...inputStyle, width: 70 }}
                />
                <input
                  type="time"
                  name="shift_start_time"
                  defaultValue={p?.shift_start_time ?? ''}
                  title="شروع ساعات کاری (خالی = بدون محدودیت)"
                  style={{ ...inputStyle, width: 110 }}
                />
                <input
                  type="time"
                  name="shift_end_time"
                  defaultValue={p?.shift_end_time ?? ''}
                  title="پایان ساعات کاری"
                  style={{ ...inputStyle, width: 110 }}
                />
                <button type="submit" className="btn" style={{ fontSize: 12 }}>
                  💾 ذخیره
                </button>
              </form>
            )
          })}
          {users.length === 0 && (
            <p className="empty-admin">کاربری پیدا نشد.</p>
          )}
        </div>
      </section>

      {/* فیلترها */}
      <form
        method="get"
        className="admin-card"
        style={{
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'end',
        }}
      >
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              display: 'block',
              marginBottom: 4,
            }}
          >
            اپراتور
          </label>
          <select name="operator" defaultValue={sp.operator ?? ''} style={inputStyle}>
            <option value="">همه</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              display: 'block',
              marginBottom: 4,
            }}
          >
            وضعیت
          </label>
          <select name="state" defaultValue={sp.state ?? ''} style={inputStyle}>
            <option value="">همه</option>
            <option value="open">باز</option>
            <option value="closed">بسته</option>
          </select>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              display: 'block',
              marginBottom: 4,
            }}
          >
            از تاریخ
          </label>
          <input type="date" name="from" defaultValue={sp.from ?? ''} style={inputStyle} />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              display: 'block',
              marginBottom: 4,
            }}
          >
            تا تاریخ
          </label>
          <input type="date" name="to" defaultValue={sp.to ?? ''} style={inputStyle} />
        </div>
        <button type="submit" className="btn">
          اعمال فیلتر
        </button>
        <a href="/admin/shifts" className="btn" style={{ textDecoration: 'none' }}>
          حذف فیلتر
        </a>
      </form>

      {/* لیست شیفت‌ها */}
      {shiftsErr && <div className="admin-error">❌ {shiftsErr.message}</div>}
      {(shifts ?? []).length === 0 && (
        <p className="empty-admin">شیفتِی با این فیلترها پیدا نشد.</p>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {(shifts ?? []).map((s: any) => {
          const t =
            totalsByShift[s.id] ?? {
              cash: 0,
              card: 0,
              online: 0,
              transfer: 0,
              orders: 0,
              open: 0,
            }
          const isOpen = !s.closed_at
          const disc =
            s.discrepancy === null || s.discrepancy === undefined
              ? null
              : Number(s.discrepancy)
          const overTolerance = disc !== null && Math.abs(disc) > TOLERANCE
          const handoverFrom = s.handover_from_shift_id
            ? handoverFromById[s.handover_from_shift_id]
            : null
          const canApprove =
            isOpen === false && !s.approved_by && s.opened_by !== currentUserId
          const canForceClose = isOpen && s.opened_by !== currentUserId
          return (
            <div
              key={s.id}
              className="admin-card"
              style={{
                borderRight: `4px solid ${
                  isOpen
                    ? '#2d5d3e'
                    : s.approved_by
                      ? '#4a7fa5'
                      : '#d9a441'
                }`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <strong style={{ fontSize: 14 }}>
                  {isOpen
                    ? '🟢'
                    : s.approved_by
                      ? '✅'
                      : '🟡'}{' '}
                  {nameById[s.opened_by] ?? s.opened_by_name ?? 'کاربر'}
                  {profileByUser[s.opened_by]?.code
                    ? ` (کد ${profileByUser[s.opened_by].code})`
                    : ''}
                </strong>
                <span style={{ fontSize: 12, color: '#766f64' }}>
                  {isOpen
                    ? `باز از ${dt(s.opened_at)}`
                    : `${dt(s.opened_at)} ← بسته در ${dt(s.closed_at)}`}
                </span>
              </div>
              {!isOpen && (
                <div style={{ fontSize: 12, marginTop: 4, color: s.approved_by ? '#4a7fa5' : '#9a6b3f' }}>
                  {s.approved_by
                    ? `گزارش بستن تایید شد توسط ${nameById[s.approved_by] ?? 'مدیر'}`
                    : 'گزارش بستن در انتظار تایید مدیر'}
                </div>
              )}

              {/* تحویل صندوق */}
              {handoverFrom && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12.5,
                    padding: '6px 10px',
                    background: '#f6f1e9',
                    borderRadius: 8,
                    color: '#4b443b',
                  }}
                >
                  📥 تحویل از{' '}
                  <strong>
                    {handoverFrom.opened_by_name
                      ? nameById[handoverFrom.opened_by] ?? handoverFrom.opened_by_name
                      : 'شیفت قبلی'}
                  </strong>
                  : اعلامی <strong>{fmt(Number(s.handover_expected ?? 0))}</strong>
                  {' · '}شمارش گیرنده{' '}
                  <strong>{fmt(Number(s.handover_actual ?? 0))}</strong>
                  {' · '}
                  {s.handover_accepted ? (
                    <span style={{ color: '#2d5d3e', fontWeight: 700 }}>✓ تایید گیرنده</span>
                  ) : (
                    <span style={{ color: '#9b3c32', fontWeight: 700 }}>
                      ⚠ مغایرت تحویل{' '}
                      {Number(s.handover_actual ?? 0) - Number(s.handover_expected ?? 0) !== 0
                        ? `(${fmt(Math.abs(Number(s.handover_actual ?? 0) - Number(s.handover_expected ?? 0)))} تومان)`
                        : ''}
                    </span>
                  )}
                  {s.handover_note ? ` — ${s.handover_note}` : ''}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginTop: 8,
                  fontSize: 12.5,
                  color: '#4b443b',
                }}
              >
                <span>
                  🧰 {isOpen ? 'تنخواه' : 'تنخواه افتتاحیه'}:{' '}
                  <strong>{fmt(Number(s.opening_float))}</strong>
                </span>
                <span>
                  💵 نقدی: <strong>{fmt(t.cash)}</strong>
                </span>
                <span>
                  📟 کارت‌خوان: <strong>{fmt(t.card)}</strong>
                </span>
                <span>
                  🌐 درگاه: <strong>{fmt(t.online)}</strong>
                </span>
                <span>
                  🏦 کارت‌به‌کارت: <strong>{fmt(t.transfer)}</strong>
                </span>
                <span>
                  🛒 سفارش: <strong>{fmt(t.orders)}</strong>
                </span>
                {t.open > 0 && (
                  <span style={{ color: '#9a6b3f' }}>
                    ⚠️ باز مانده: <strong>{fmt(t.open)}</strong>
                  </span>
                )}
              </div>
              {!isOpen && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 6,
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: '#766f64' }}>
                    🧮 شمارش واقعی:{' '}
                    <strong>
                      {s.counted_cash === null || s.counted_cash === undefined
                        ? '—'
                        : fmt(Number(s.counted_cash))}
                    </strong>
                  </span>
                  {disc !== null && (
                    <span
                      style={{
                        fontWeight: 800,
                        color: disc === 0 ? '#2d5d3e' : overTolerance ? '#9b3c32' : '#9a6b3f',
                      }}
                    >
                      {disc === 0
                        ? '✅ بدون مغایرت'
                        : overTolerance
                          ? `🚨 ${disc > 0 ? 'مازاد' : 'کسری'} ${fmt(Math.abs(disc))} — بالای حد مجاز (${fmt(TOLERANCE)})`
                          : `⚠️ ${disc > 0 ? 'مازاد' : 'کسری'} ${fmt(Math.abs(disc))} — در حد مجاز`}
                    </span>
                  )}
                  {s.closing_open_orders > 0 && (
                    <span style={{ color: '#766f64' }}>
                      🧾 {fmt(Number(s.closing_open_orders))} سفارش باز موقع بستن مانده بود
                    </span>
                  )}
                  {s.closing_note ? (
                    <span style={{ color: '#766f64' }}>📝 {s.closing_note}</span>
                  ) : null}
                </div>
              )}

              {/* تایید گزارش / بستن اجباری */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 10,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {canApprove && (
                  <form action={approveShift}>
                    <input type="hidden" name="shift_id" value={s.id} />
                    <button
                      type="submit"
                      className="btn"
                      style={{
                        fontSize: 12,
                        background: '#2d5d3e',
                        color: '#fff',
                        borderColor: '#2d5d3e',
                      }}
                    >
                      ✓ تایید گزارش بستن
                    </button>
                  </form>
                )}
                {canForceClose && (
                  <form
                    action={forceCloseShift}
                    style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                  >
                    <input type="hidden" name="shift_id" value={s.id} />
                    <input
                      name="note"
                      placeholder="دلیل بستن اجباری (اختیاری)"
                      style={{ ...inputStyle, width: 200, fontSize: 12 }}
                    />
                    <button
                      type="submit"
                      className="btn"
                      style={{ fontSize: 12, color: '#9b3c32', borderColor: '#9b3c32' }}
                    >
                      🔒 بستن اجباری
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
