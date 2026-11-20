import { supabaseAdmin } from '@/lib/supabase/server'

// 🎯 پچ ۵۴ — گزارش‌های حسابداری (به الگوی فصل اول پارسیان):
// تراز آزمایشی + سود و زیان در یک بازهٔ تاریخ — مشترک بین صفحهٔ حسابداری
// و مسیر خروجی CSV تا محاسبه فقط یک‌جا تعریف شود

export type ReportRow = {
  account_id: string
  name: string
  kind: string
  treasury_type: string | null
  turnD: number // گردش بدهکار در بازه
  turnC: number // گردش بستانکار در بازه
  bal: number // بدهکار − بستانکار (برای درآمد منفی = بستانکار)
}

export type AccountingReport = {
  from: string
  to: string
  rows: ReportRow[] // حساب‌هایی که در بازه گردش دارند — به ترتیب خزانه، درآمد، هزینه
  incomeNet: number // Σ(بستانکار − بدهکار) حساب‌های درآمد
  expenseNet: number // Σ(بدهکار − بستانکار) حساب‌های هزینه
  profit: number // درآمد − هزینه (منفی = زیان)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// بازهٔ پیش‌فرض: اول ماه جاری تا امروز (گرگوریت — هماهنگ با بقیهٔ فیلترهای پنل)
export function reportRange(
  from?: string,
  to?: string
): { from: string; to: string } {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const defFrom = `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`
  const defTo = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  return {
    from: from && DATE_RE.test(from) ? from : defFrom,
    to: to && DATE_RE.test(to) ? to : defTo,
  }
}

export async function computeAccountingReport(
  rfrom: string,
  rto: string
): Promise<AccountingReport> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('gl_lines')
    .select(
      'side, amount, account_id, gl_accounts(name, kind, treasury_type), gl_entries!inner(entry_date)'
    )
    .gte('gl_entries.entry_date', `${rfrom}T00:00:00`)
    .lte('gl_entries.entry_date', `${rto}T23:59:59`)
  if (error) {
    console.error('[accounting report]', error.message)
  }

  const byAcc: Record<
    string,
    { name: string; kind: string; treasury_type: string | null; turnD: number; turnC: number }
  > = {}
  for (const l of data ?? []) {
    const acc0 = l.gl_accounts as any
    if (!acc0) continue
    const rec = (byAcc[l.account_id] ??= {
      name: acc0.name,
      kind: acc0.kind,
      treasury_type: acc0.treasury_type ?? null,
      turnD: 0,
      turnC: 0,
    })
    const amt = Number(l.amount) || 0
    if (l.side === 'debit') rec.turnD += amt
    else rec.turnC += amt
  }

  const kindOrder: Record<string, number> = {
    treasury: 0,
    income: 1,
    expense: 2,
  }
  const rows: ReportRow[] = Object.entries(byAcc)
    .map(([id, r]) => ({
      account_id: id,
      name: r.name,
      kind: r.kind,
      treasury_type: r.treasury_type,
      turnD: r.turnD,
      turnC: r.turnC,
      bal: r.turnD - r.turnC,
    }))
    .sort(
      (a, b) =>
        (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
        a.name.localeCompare(b.name, 'fa')
    )

  let incomeNet = 0
  let expenseNet = 0
  for (const r of rows) {
    if (r.kind === 'income') incomeNet += r.turnC - r.turnD
    if (r.kind === 'expense') expenseNet += r.turnD - r.turnC
  }

  return {
    from: rfrom,
    to: rto,
    rows,
    incomeNet,
    expenseNet,
    profit: incomeNet - expenseNet,
  }
}
