import { supabaseAdmin } from '@/lib/supabase/server'
import {
  createAccount,
  deactivateAccount,
  deleteManualEntry,
  syncTreasuryAccounts,
} from './actions'
import TreasuryEntryForm from '@/app/admin/components/TreasuryEntryForm'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۳ — خزانه و حسابداری پایه:
// ماندهٔ حساب‌های خزانه + سند دستی دوطرفه + اسناد خودکار فروش POS + مدیریت سرفصل‌ها
// هر سند = حداقل دو قلم (بدهکار مقصد پول / بستانکار مبدا) — مانده = بدهکار − بستانکار

type SP = { acc?: string; from?: string; to?: string; kind?: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TRE_ICON: Record<string, string> = {
  cash: '💵',
  card_reader: '🖥',
  online: '🌐',
  transfer: '🔁',
  bank: '🏦',
}

const inputStyle: React.CSSProperties = {
  fontSize: 12.5,
  padding: '6px 9px',
  borderRadius: 8,
  border: '1px solid #d8d0c4',
  font: 'inherit',
  color: '#4b443b',
  background: '#fff',
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR')
}

export default async function TreasuryPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const db = supabaseAdmin()

  // حساب‌ها + مانده‌ها
  const { data: accounts } = await db
    .from('gl_accounts')
    .select('id, name, kind, treasury_type, is_active, sort')
    .order('sort', { ascending: true })
  const { data: balRows } = await db
    .from('gl_account_balances')
    .select('account_id, balance, line_count')
  const balBy: Record<string, number> = {}
  for (const b of balRows ?? []) balBy[b.account_id] = Number(b.balance) || 0

  const all = accounts ?? []
  const treasuries = all.filter(
    (a: any) => a.kind === 'treasury' && a.is_active
  )
  const incomes = all.filter((a: any) => a.kind === 'income' && a.is_active)
  const expenses = all.filter((a: any) => a.kind === 'expense' && a.is_active)
  const totalTreasury = treasuries.reduce(
    (s: number, a: any) => s + (balBy[a.id] ?? 0),
    0
  )

  // اسناد با فیلتر (ماندهٔ جدیدترین‌ها)
  let q = db
    .from('gl_entries')
    .select(
      'id, entry_no, entry_date, description, source, created_by_name, gl_lines(side, amount, gl_accounts(name, kind, treasury_type))'
    )
    .order('entry_date', { ascending: false })
    .limit(60)
  if (sp.kind === 'pos' || sp.kind === 'manual') q = q.eq('source', sp.kind)
  if (sp.acc && UUID_RE.test(sp.acc)) q = q.eq('gl_lines.account_id', sp.acc)
  if (sp.from) q = q.gte('entry_date', `${sp.from}T00:00:00`)
  if (sp.to) q = q.lte('entry_date', `${sp.to}T23:59:59`)
  const { data: entries } = await q

  const accOptions = [...all]
    .filter((a: any) => a.is_active)
    .sort((a: any, b: any) =>
      a.kind === b.kind ? 0 : a.kind === 'treasury' ? -1 : b.kind === 'treasury' ? 1 : 0
    )

  return (
    <div>
      <h1 className="admin-page-title" style={{ marginBottom: 6 }}>
        💰 خزانه و حسابداری
      </h1>
      <p className="admin-page-sub" style={{ marginBottom: 18 }}>
        هر سند دوطرفه است: پول از یک حساب (بستانکار) به حساب دیگر (بدهکار) می‌رود.
        فروش‌های POS خودکار در دفتر ثبت می‌شوند؛ هزینه‌ها و انتقال‌ها را دستی ثبت کن.
      </p>

      {/* ماندهٔ حساب‌های خزانه */}
      <section
        className="admin-card"
        style={{ marginBottom: 16, padding: 14 }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}
        >
          {treasuries.map((a: any) => {
            const bal = balBy[a.id] ?? 0
            return (
              <div
                key={a.id}
                style={{
                  flex: '1 1 150px',
                  minWidth: 150,
                  border: '1px solid #e3ddd2',
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 12, color: '#766f64', fontWeight: 700 }}>
                  {TRE_ICON[a.treasury_type ?? ''] || '💰'} {a.name}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    marginTop: 4,
                    color: bal < 0 ? '#9b3c32' : '#2d5d3e',
                  }}
                >
                  {fa(bal)} <span style={{ fontSize: 11 }}>تومان</span>
                </div>
              </div>
            )
          })}
          <div
            style={{
              flex: '1 1 170px',
              minWidth: 170,
              border: '2px solid #2d5d3e',
              borderRadius: 10,
              padding: '10px 12px',
              background: '#e8f3ec',
            }}
          >
            <div style={{ fontSize: 12, color: '#2d5d3e', fontWeight: 800 }}>
              Σ مجموع خزانه
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
              {fa(totalTreasury)}{' '}
              <span style={{ fontSize: 11 }}>تومان</span>
            </div>
          </div>
        </div>
        {treasuries.length === 0 && (
          <p className="empty-admin">
            هنوز حساب خزانه‌ای نیست — با دکمهٔ «همگام‌سازی حساب‌ها» از صندوق‌ها و
            کارت‌خوان‌ها بساز.
          </p>
        )}
        <form action={syncTreasuryAccounts} style={{ marginTop: 10 }}>
          <button
            type="submit"
            className="btn"
            style={{ fontSize: 12 }}
            title="برای هر صندوق نقدی و کارت‌خوان فعال، حساب خزانه می‌سازد (فقط حساب‌های جدید)"
          >
            🔄 همگام‌سازی حساب‌ها از صندوق‌ها/کارت‌خوان‌ها
          </button>
        </form>
      </section>

      {/* سند دستی */}
      <section className="admin-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, marginBottom: 10 }}>✍️ ثبت سند دستی</h2>
        <TreasuryEntryForm
          treasury={treasuries.map((t: any) => ({
            id: t.id,
            name: t.name,
            treasury_type: t.treasury_type,
          }))}
          income={incomes.map((c: any) => ({
            id: c.id,
            name: c.name,
            treasury_type: null,
          }))}
          expense={expenses.map((c: any) => ({
            id: c.id,
            name: c.name,
            treasury_type: null,
          }))}
        />
        <p style={{ fontSize: 11.5, color: '#8a8378', marginTop: 8 }}>
          دریافت = درآمد (مثلاً سرمایهٔ اولیه) به یک حساب خزانه · پرداخت = خرجِ
          هزینه از خزانه · انتقال = جابه‌جایی بین حساب‌ها (مثلاً تسویهٔ کارت‌خوان به بانک)
        </p>
      </section>

      {/* مدیریت حساب‌ها و سرفصل‌ها */}
      <section className="admin-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, marginBottom: 10 }}>
          🗂 سرفصل‌ها و حساب‌ها
        </h2>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {[
            {
              choice: 'expense',
              label: 'سرفصل هزینهٔ جدید',
              ph: 'مثلاً هزینهٔ اینترنت',
              color: '#9b3c32',
            },
            {
              choice: 'income',
              label: 'سرفصل درآمد جدید',
              ph: 'مثلاً اجارهٔ فضا',
              color: '#2d5d3e',
            },
            {
              choice: 'bank',
              label: 'حساب بانکی جدید',
              ph: 'مثلاً بانک ملت — جاری ۱۲۳',
              color: '#4a7fa5',
            },
          ].map((f) => (
            <form
              key={f.choice}
              action={createAccount}
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <input type="hidden" name="choice" value={f.choice} />
              <input
                name="name"
                placeholder={f.ph}
                style={{ ...inputStyle, width: 170 }}
              />
              <button
                type="submit"
                className="btn"
                style={{ fontSize: 11.5, borderColor: f.color, color: f.color }}
              >
                ➕ {f.label}
              </button>
            </form>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {[
            { list: treasuries, title: 'خزانه' },
            { list: incomes, title: 'درآمد' },
            { list: expenses, title: 'هزینه' },
          ].map((g) => (
            <div key={g.title} style={{ minWidth: 200, flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#766f64',
                  marginBottom: 6,
                }}
              >
                {g.title} ({fa(g.list.length)})
              </div>
              {g.list.map((a: any) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    padding: '4px 0',
                    borderBottom: '1px dashed #eee7db',
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {TRE_ICON[a.treasury_type ?? ''] || ''}
                    {a.kind === 'expense' ? '📤 ' : a.kind === 'income' ? '📥 ' : ''}
                    {a.name}
                  </span>
                  {balBy[a.id] !== undefined && (
                    <span
                      style={{
                        color: (balBy[a.id] ?? 0) < 0 ? '#9b3c32' : '#4b443b',
                        fontWeight: 700,
                      }}
                    >
                      {fa(balBy[a.id] ?? 0)}
                    </span>
                  )}
                  <form action={deactivateAccount}>
                    <input type="hidden" name="account_id" value={a.id} />
                    <button
                      type="submit"
                      title="غیرفعال‌کردن — از انتخاب‌ها حذف می‌شود ولی تاریخچه می‌ماند"
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#9b3c32',
                        font: 'inherit',
                      }}
                    >
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* اسناد */}
      <section className="admin-card">
        <h2 style={{ fontSize: 14, marginBottom: 10 }}>📒 اسناد روزنامه</h2>

        {/* فیلترها */}
        <form
          method="get"
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'end',
            marginBottom: 14,
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
              حساب
            </label>
            <select name="acc" defaultValue={sp.acc ?? ''} style={inputStyle}>
              <option value="">همه</option>
              {accOptions.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {TRE_ICON[a.treasury_type ?? ''] || ''}
                  {a.kind === 'expense' ? '📤 ' : a.kind === 'income' ? '📥 ' : ''}
                  {a.name}
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
              نوع
            </label>
            <select name="kind" defaultValue={sp.kind ?? ''} style={inputStyle}>
              <option value="">همه</option>
              <option value="pos">خودکار (فروش POS)</option>
              <option value="manual">دستی</option>
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
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ''}
              style={inputStyle}
            />
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
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ''}
              style={inputStyle}
            />
          </div>
          <button type="submit" className="btn" style={{ fontSize: 12 }}>
            🔎 فیلتر
          </button>
        </form>

        {(entries ?? []).map((e: any) => {
          const lines = (e.gl_lines ?? []) as any[]
          const isManual = e.source === 'manual'
          return (
            <div
              key={e.id}
              style={{
                border: '1px solid #e3ddd2',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 8,
                background: isManual ? '#fffdf8' : '#fff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#766f64',
                    background: '#f4efe6',
                    borderRadius: 999,
                    padding: '2px 8px',
                  }}
                >
                  سند #{fa(Number(e.entry_no))}
                </span>
                <span style={{ fontSize: 11.5, color: '#8a8378' }}>
                  {new Date(e.entry_date).toLocaleString('fa-IR')}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '2px 8px',
                    background: isManual ? '#fff4d9' : '#e8f3ec',
                    color: isManual ? '#9a6b3f' : '#2d5d3e',
                  }}
                >
                  {isManual ? 'دستی — ' + (e.created_by_name ?? 'مدیر') : 'خودکار از POS'}
                </span>
                {isManual && (
                  <form action={deleteManualEntry} style={{ marginInlineStart: 'auto' }}>
                    <input type="hidden" name="entry_id" value={e.id} />
                    <button
                      type="submit"
                      title="حذف سند دستی"
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#9b3c32',
                        font: 'inherit',
                      }}
                    >
                      🗑 حذف
                    </button>
                  </form>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {e.description}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {lines.map((l: any, i: number) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 12,
                      color: l.side === 'debit' ? '#2d5d3e' : '#9b3c32',
                      fontWeight: 600,
                      background: '#f8f5ef',
                      borderRadius: 8,
                      padding: '3px 8px',
                    }}
                  >
                    {l.side === 'debit' ? '⬆ بدهکار' : '⬇ بستانکار'} ·{' '}
                    {TRE_ICON[l.gl_accounts?.treasury_type ?? ''] || ''}
                    {l.gl_accounts?.kind === 'expense' ? '📤 ' : l.gl_accounts?.kind === 'income' ? '📥 ' : ''}
                    {l.gl_accounts?.name ?? '؟'} — {fa(Number(l.amount))}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
        {(entries ?? []).length === 0 && (
          <p className="empty-admin">
            سندی پیدا نشد — اولین فروش POS یا سند دستی، اولین سند را می‌سازد.
          </p>
        )}
      </section>
    </div>
  )
}
