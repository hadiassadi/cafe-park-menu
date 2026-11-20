import { NextRequest, NextResponse } from 'next/server'
import { assertPathAccess } from '@/lib/admin/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import { toEnDigits } from '@/lib/wallet/charge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۳-ج — دفتر معین (گردش یک حساب) برای مودال مشترک صفحهٔ حسابداری:
// ۱۰ ردیف در هر صفحه + جستجو در همهٔ ستون‌ها (شرح سند، شرح ردیف، حساب، مبلغ،
// شمارهٔ سند، سازنده، نوع سند) + جمع بدهکار/بستانکارِ نتیجه

const PAGE_SIZE = 10
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// فیلتر مشترک هر دو کوئری (ردیف‌ها + جمع‌ها) — جستجو در همهٔ ستون‌ها
function applyLedgerFilters(query: any, accId: string, q: string): any {
  let out = query.eq('account_id', accId)
  const clean = toEnDigits(q)
    .replace(/["%_(),\\]/g, '')
    .trim()
  if (clean) {
    const like = `%${clean}%`
    const conds = [
      `description.ilike."${like}"`, // شرح ردیف
      `gl_entries.description.ilike."${like}"`, // شرح سند
      `gl_entries.created_by_name.ilike."${like}"`, // سازنده
      `gl_entries.source.ilike."${like}"`, // نوع سند
      `gl_accounts.name.ilike."${like}"`, // نام حساب
    ]
    const digits = clean.replace(/[^\d]/g, '')
    if (digits) {
      conds.push(`amount.eq.${digits}`) // مبلغ
      conds.push(`gl_entries.entry_no.eq.${digits}`) // شمارهٔ سند
    }
    out = out.or(conds.join(','))
  }
  return out
}

export async function GET(req: NextRequest) {
  try {
    await assertPathAccess('/admin/accounting')
    const sp = req.nextUrl.searchParams
    const acc = sp.get('acc') ?? ''
    const page = Math.max(1, Math.min(500, Number(sp.get('page') ?? '1') || 1))
    const q = (sp.get('q') ?? '').slice(0, 60)
    if (!UUID_RE.test(acc)) {
      return NextResponse.json({ error: 'حساب نامعتبر است' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const [{ data: acc0 }, { data: bal0 }] = await Promise.all([
      db
        .from('gl_accounts')
        .select('id, name, kind, treasury_type')
        .eq('id', acc)
        .maybeSingle(),
      db
        .from('gl_account_balances')
        .select('balance')
        .eq('account_id', acc)
        .maybeSingle(),
    ])
    if (!acc0) {
      return NextResponse.json({ error: 'حساب پیدا نشد' }, { status: 404 })
    }

    const from = (page - 1) * PAGE_SIZE
    const [rowsRes, sumsRes] = await Promise.all([
      applyLedgerFilters(
        db
          .from('gl_lines')
          .select(
            'id, side, amount, description, gl_accounts(name, kind, treasury_type), gl_entries!inner(entry_no, entry_date, description, source, created_by_name)',
            { count: 'exact' }
          ),
        acc,
        q
      )
        .order('entry_date', { foreignTable: 'gl_entries', ascending: false })
        .order('entry_no', { foreignTable: 'gl_entries', ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
      // جمعِ کل نتیجهٔ فیلترشده (برای ردیف جمعِ دفتر معین)
      applyLedgerFilters(
        db.from('gl_lines').select('side, amount'),
        acc,
        q
      ),
    ])

    if (rowsRes.error) {
      console.error('[gl ledger] rows:', rowsRes.error.message)
      return NextResponse.json(
        { error: 'خطا در خواندن دفتر معین' },
        { status: 500 }
      )
    }

    let sumDebit = 0
    let sumCredit = 0
    for (const l of sumsRes.data ?? []) {
      if (l.side === 'debit') sumDebit += Number(l.amount) || 0
      else sumCredit += Number(l.amount) || 0
    }

    const rows = (rowsRes.data ?? []).map((r: any) => ({
      id: r.id,
      side: r.side,
      amount: r.amount,
      description: r.description,
      entry_no: r.gl_entries?.entry_no ?? null,
      entry_date: r.gl_entries?.entry_date ?? null,
      entry_desc: r.gl_entries?.description ?? '',
      source: r.gl_entries?.source ?? '',
      created_by_name: r.gl_entries?.created_by_name ?? null,
    }))

    const total = rowsRes.count ?? 0
    return NextResponse.json({
      account: acc0,
      balance: Number(bal0?.balance) || 0,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      sumDebit,
      sumCredit,
      rows,
    })
  } catch (err) {
    console.error('[gl ledger] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
