import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { createClient } from '@supabase/supabase-js'
import { setOperatorCode } from './actions'

export const metadata: Metadata = {
  title: 'شیفت ها',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۱: گزارش شیفت‌های کاری — فیلتر اپراتور × وضعیت × بازهٔ تاریخ
// + تعیین کد کوتاه اپراتورها (مبنای مغایرت‌گیری؛ در فاز خزانه به اسناد روزنامه وصل می‌شود)

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n)
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

  const db = createClient(url, key, { auth: { persistSession: false } })

  // کاربران ادمین + کد اپراتوری آن‌ها
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
      .select('user_id, code')
    profilesRows = data ?? []
  } catch (e) {
    console.error('[shifts page] profiles:', e)
  }
  const codeByUser: Record<string, string> = {}
  for (const p of profilesRows) codeByUser[p.user_id] = p.code
  const users = userRows.map((u: any) => ({
    id: u.id,
    name:
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

  // جمع‌های هر شیفت از دفتر پرداخت + سفارش‌ها
  const ids = (shifts ?? []).map((s: any) => s.id)
  const totalsByShift: Record<string, ShiftTotals> = {}
  if (ids.length > 0) {
    const [pays, ords] = await Promise.all([
      db
        .from('order_payments')
        .select('shift_id, method, amount')
        .in('shift_id', ids)
        .eq('status', 'confirmed'),
      db.from('orders').select('shift_id').in('shift_id', ids),
    ])
    for (const s of ids) {
      totalsByShift[s] = { cash: 0, card: 0, online: 0, transfer: 0, orders: 0 }
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
      if (t) t.orders += 1
    }
  }

  return (
    <main className="admin">
      <div className="admin-header">
        <div>
          <h1>⏱ شیفت‌ها و عملیات اپراتورها</h1>
          <p className="admin-subtitle">
            هر شیفت = کار یک اپراتور از باز کردن تا بستن — مبنای مغایرت‌گیری و
            فیلتر شخص × تاریخ × شیفت
          </p>
        </div>
      </div>

      {/* کدهای اپراتور */}
      <section className="admin-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>🏷 کد اپراتورها</h2>
        <p style={{ fontSize: 12.5, color: '#766f64', margin: '0 0 10px' }}>
          کد کوتاه هر کاربر (مثلاً ۱ یا ۲ یا ... ) — در گزارش‌ها کنار نام می‌آید؛
          کد تکراری ذخیره نمی‌شود. خالی بگذاری و ذخیره کنی، کد برداشته می‌شود.
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {users.map((u) => (
            <form
              key={u.id}
              action={setOperatorCode}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <input type="hidden" name="user_id" value={u.id} />
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
                👤 {u.name}
                {codeByUser[u.id] ? ` — کد فعلی: ${codeByUser[u.id]}` : ''}
              </span>
              <input
                name="code"
                defaultValue={codeByUser[u.id] ?? ''}
                placeholder="کد"
                style={{ ...inputStyle, width: 90 }}
              />
              <button type="submit" className="btn" style={{ fontSize: 12 }}>
                💾 ذخیره
              </button>
            </form>
          ))}
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
            }
          const isOpen = !s.closed_at
          const disc =
            s.discrepancy === null || s.discrepancy === undefined
              ? null
              : Number(s.discrepancy)
          return (
            <div
              key={s.id}
              className="admin-card"
              style={{ borderRight: `4px solid ${isOpen ? '#2d5d3e' : '#d8d0c4'}` }}
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
                  {isOpen ? '🟢' : '🔒'} {nameById[s.opened_by] ?? 'کاربر'}
                  {codeByUser[s.opened_by]
                    ? ` (کد ${codeByUser[s.opened_by]})`
                    : ''}
                </strong>
                <span style={{ fontSize: 12, color: '#766f64' }}>
                  {isOpen
                    ? `باز از ${dt(s.opened_at)}`
                    : `${dt(s.opened_at)} ← بسته در ${dt(s.closed_at)}`}
                </span>
              </div>
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
                  🧰 تنخواه: <strong>{fmt(Number(s.opening_float))}</strong>
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
                        color: disc === 0 ? '#2d5d3e' : '#9b3c32',
                      }}
                    >
                      {disc === 0
                        ? '✅ بدون مغایرت'
                        : disc > 0
                          ? `⚠️ مازاد ${fmt(disc)}`
                          : `⚠️ کسری ${fmt(Math.abs(disc))}`}
                    </span>
                  )}
                  {s.closing_note ? (
                    <span style={{ color: '#766f64' }}>📝 {s.closing_note}</span>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
