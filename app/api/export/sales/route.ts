import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { getSalesReport, type SalesReportFilter } from '@/lib/stats'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

type ExportType = 'daily' | 'products' | 'categories' | 'summary'

const ALLOWED_TYPES: readonly ExportType[] = [
  'daily',
  'products',
  'categories',
  'summary',
]

const FILTER_LABELS: Record<SalesReportFilter, string> = {
  today: 'today',
  week: 'week',
  month: 'month',
  last_month: 'last-month',
  quarter: 'quarter',
  all: 'all',
}

function toCsvNumber(n: number): string {
  return String(Math.round(Number(n) || 0))
}

// جلوگیری از Formula Injection در Excel
function neutralize(str: string): string {
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
}

// فقط یک بار escape؛ همه‌ی سلول‌ها از این تابع رد می‌شوند
function cell(value: string): string {
  const str = neutralize(String(value ?? ''))
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const { searchParams } = new URL(request.url)

    const rawType = searchParams.get('type') || 'daily'
    const rawFilter = searchParams.get('filter') || 'month'

    const type: ExportType = (ALLOWED_TYPES as readonly string[]).includes(
      rawType
    )
      ? (rawType as ExportType)
      : 'daily'

    const filter: SalesReportFilter = Object.prototype.hasOwnProperty.call(
      FILTER_LABELS,
      rawFilter
    )
      ? (rawFilter as SalesReportFilter)
      : 'month'

    const report = await getSalesReport(filter)
    const dateStr = new Date().toISOString().split('T')[0]
    const filterSlug = FILTER_LABELS[filter]

    let headers: string[] = []
    let rows: string[][] = []
    let filename = ''
    let title = ''

    if (type === 'daily') {
      title = `گزارش فروش روزانه — ${report.summary.period_label}`
      filename = `sales-daily-${filterSlug}-${dateStr}.csv`
      headers = [
        'تاریخ',
        'تعداد سفارش',
        'فروش (تومان)',
        'تخفیف (تومان)',
        'خالص (تومان)',
        'میانگین هر سفارش (تومان)',
      ]
      rows = report.daily.map((d) => [
        d.date,
        toCsvNumber(d.orders),
        toCsvNumber(d.revenue),
        toCsvNumber(d.discount),
        toCsvNumber(d.net),
        toCsvNumber(d.avg),
      ])

      rows.push([
        'جمع کل',
        toCsvNumber(report.summary.total_orders),
        toCsvNumber(report.summary.total_revenue),
        toCsvNumber(report.summary.total_discount),
        toCsvNumber(report.summary.total_revenue),
        toCsvNumber(report.summary.avg_order_value),
      ])
    } else if (type === 'products') {
      title = `گزارش فروش محصولات — ${report.summary.period_label}`
      filename = `sales-products-${filterSlug}-${dateStr}.csv`
      headers = ['محصول', 'تعداد فروش', 'درآمد (تومان)', 'سهم درصدی']
      rows = report.products.map((p) => [
        p.product_name,
        toCsvNumber(p.quantity),
        toCsvNumber(p.revenue),
        toCsvNumber(p.percentage) + '٪',
      ])
    } else if (type === 'categories') {
      title = `گزارش فروش دسته‌بندی — ${report.summary.period_label}`
      filename = `sales-categories-${filterSlug}-${dateStr}.csv`
      headers = ['دسته‌بندی', 'تعداد فروش', 'درآمد (تومان)', 'سهم درصدی']
      rows = report.categories.map((c) => [
        c.category_name,
        toCsvNumber(c.quantity),
        toCsvNumber(c.revenue),
        toCsvNumber(c.percentage) + '٪',
      ])
    } else {
      title = `خلاصه گزارش فروش — ${report.summary.period_label}`
      filename = `sales-summary-${filterSlug}-${dateStr}.csv`
      headers = ['عنوان', 'مقدار']
      rows = [
        ['بازه گزارش', report.summary.period_label],
        ['کل فروش (تومان)', toCsvNumber(report.summary.total_revenue)],
        ['تعداد سفارش', toCsvNumber(report.summary.total_orders)],
        ['کل تخفیف (تومان)', toCsvNumber(report.summary.total_discount)],
        [
          'میانگین هر سفارش (تومان)',
          toCsvNumber(report.summary.avg_order_value),
        ],
        ['تعداد لغو', toCsvNumber(report.summary.cancelled_count)],
        [
          'مبلغ لغو شده (تومان)',
          toCsvNumber(report.summary.cancelled_amount),
        ],
      ]
    }

    const BOM = '\uFEFF'
    const titleLine = cell(title) + '\n\n'
    const headerLine = headers.map(cell).join(',') + '\n'
    const bodyLines = rows.map((row) => row.map(cell).join(',')).join('\n')

    const csv = BOM + titleLine + headerLine + bodyLines

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('[export/sales] error:', err)
    return apiError(err)
  }
}
