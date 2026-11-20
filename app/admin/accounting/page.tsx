import { supabaseAdmin } from '@/lib/supabase/server'
import TreasuryClient, {
  EntryRow,
} from '@/app/admin/components/TreasuryClient'
import {
  computeAccountingReport,
  reportRange,
} from '@/lib/accounting/reports'
import { requirePagePath } from '@/lib/admin/roles'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۳-ب/ج/۵۴/۵۶ — حسابداری: این صفحه فقط داده می‌خواند؛
// همهٔ UI (تب‌ها، جدول اسناد با ستون بدهکار/بستانکار، مودال ثبت سند چندردیفه،
// مودال دفتر معین، تب گزارش‌ها) در TreasuryClient است. مانده = بدهکار − بستانکار
// گارد نقش: فقط مالک (پچ ۵۶) — مدیر/صندوق‌دار به داشبورد برمی‌گردند

type SP = {
  acc?: string
  from?: string
  to?: string
  kind?: string
  rfrom?: string
  rto?: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function TreasuryPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  await requirePagePath('/admin/accounting')
  const sp = await searchParams
  const db = supabaseAdmin()

  // حساب‌ها + مانده‌ها
  const { data: accounts } = await db
    .from('gl_accounts')
    .select('id, name, kind, treasury_type, is_active, sort')
    .order('sort', { ascending: true })
  const { data: balRows } = await db
    .from('gl_account_balances')
    .select('account_id, balance')

  const balances: Record<string, number> = {}
  for (const b of balRows ?? [])
    balances[b.account_id] = Number(b.balance) || 0

  const all = accounts ?? []
  const treasuries = all
    .filter((a: any) => a.kind === 'treasury' && a.is_active)
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      treasury_type: a.treasury_type,
    }))
  const incomes = all
    .filter((a: any) => a.kind === 'income' && a.is_active)
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      treasury_type: null,
    }))
  const expenses = all
    .filter((a: any) => a.kind === 'expense' && a.is_active)
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      treasury_type: null,
    }))
  const totalTreasury = treasuries.reduce(
    (s, a) => s + (balances[a.id] ?? 0),
    0
  )

  // اسناد با فیلتر (ماندهٔ جدیدترین‌ها)
  let q = db
    .from('gl_entries')
    .select(
      'id, entry_no, entry_date, description, source, created_by_name, gl_lines(side, amount, description, gl_accounts(name, kind, treasury_type))'
    )
    .order('entry_date', { ascending: false })
    .limit(60)
  if (sp.kind === 'pos' || sp.kind === 'manual') q = q.eq('source', sp.kind)
  if (sp.acc && UUID_RE.test(sp.acc)) q = q.eq('gl_lines.account_id', sp.acc)
  if (sp.from) q = q.gte('entry_date', `${sp.from}T00:00:00`)
  if (sp.to) q = q.lte('entry_date', `${sp.to}T23:59:59`)
  const { data: entries } = await q

  // گزارش‌ها (پچ ۵۴): بازهٔ پیش‌فرض = اول ماه جاری تا امروز
  const range = reportRange(sp.rfrom, sp.rto)
  const report = await computeAccountingReport(range.from, range.to)

  return (
    <TreasuryClient
      treasuries={treasuries}
      incomes={incomes}
      expenses={expenses}
      balances={balances}
      totalTreasury={totalTreasury}
      entries={(entries ?? []) as unknown as EntryRow[]}
      filters={sp}
      report={report}
    />
  )
}
