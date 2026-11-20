import { NextRequest, NextResponse } from 'next/server'
import { assertPathAccess } from '@/lib/admin/roles'
import {
  computeAccountingReport,
  reportRange,
} from '@/lib/accounting/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۴ — خروجی CSV (اکسل) گزارش حسابداری: تراز آزمایشی + سود و زیان
// در بازهٔ انتخابی — با BOM تا فارسی در اکسل درست باز شود

function esc(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  try {
    await assertPathAccess('/admin/accounting')
    const sp = req.nextUrl.searchParams
    const { from, to } = reportRange(
      sp.get('rfrom') ?? undefined,
      sp.get('rto') ?? undefined
    )
    const rep = await computeAccountingReport(from, to)

    const L: string[] = []
    L.push(`گزارش حسابداری از ${from} تا ${to}`)
    L.push('')
    L.push('تراز آزمایشی')
    L.push('حساب,گردش بدهکار,گردش بستانکار,مانده دوره (بدهکار-بستانکار)')
    for (const r of rep.rows) {
      L.push([esc(r.name), r.turnD, r.turnC, r.bal].join(','))
    }
    const sumD = rep.rows.reduce((s, r) => s + r.turnD, 0)
    const sumC = rep.rows.reduce((s, r) => s + r.turnC, 0)
    L.push(`جمع,${sumD},${sumC},`)
    L.push('')
    L.push('سود و زیان')
    L.push('نوع,حساب,مانده دوره')
    for (const r of rep.rows.filter((r) => r.kind === 'income')) {
      L.push(['درآمد', esc(r.name), r.turnC - r.turnD].join(','))
    }
    for (const r of rep.rows.filter((r) => r.kind === 'expense')) {
      L.push(['هزینه', esc(r.name), r.turnD - r.turnC].join(','))
    }
    L.push(`درآمد کل,,,${rep.incomeNet}`)
    L.push(`هزینه کل,,,${rep.expenseNet}`)
    L.push(`سود (زیان) خالص,,,${rep.profit}`)

    const csv = '\ufeff' + L.join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="accounting-report-${from}_${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[reports csv] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
