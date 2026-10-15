import { NextRequest, NextResponse } from 'next/server'
import { getSalesReport, type SalesReportFilter } from '@/lib/stats'

export const dynamic = 'force-dynamic'

type ExportType = 'daily' | 'products' | 'categories' | 'summary'

const FILTER_LABELS: Record<SalesReportFilter, string> = {
  today: 'today',
  week: 'week',
  month: 'month',
  last_month: 'last-month',
  quarter: 'quarter',
  all: 'all',
}

function toCsvNumber(n: number): string {
  return String(Math.round(n))
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'daily') as ExportType
    const filter = (searchParams.get('filter') || 'month') as SalesReportFilter

    const report = await getSalesReport(filter)
    const dateStr = new Date().toISOString().split('T')[0]
    const filterSlug = FILTER_LABELS[filter] || filter

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

      // ردیف جمع کل
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
        escapeCsv(p.product_name),
        toCsvNumber(p.quantity),
        toCsvNumber(p.revenue),
        toCsvNumber(p.percentage) + '٪',
      ])
    } else if (type === 'categories') {
      title = `گزارش فروش دسته‌بندی — ${report.summary.period_label}`
      filename = `sales-categories-${filterSlug}-${dateStr}.csv`
      headers = ['دسته‌بندی', 'تعداد فروش', 'درآمد (تومان)', 'سهم درصدی']
      rows = report.categories.map((c) => [
        escapeCsv(c.category_name),
        toCsvNumber(c.quantity),
        toCsvNumber(c.revenue),
        toCsvNumber(c.percentage) + '٪',
      ])
    } else {
      // summary
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

    // ساخت CSV با BOM برای Excel فارسی
    const BOM = '\uFEFF'
    const titleLine = `"${title}"\n\n`
    const headerLine = headers.map((h) => `"${h}"`).join(',') + '\n'
    const bodyLines = rows
      .map((row) =>
        row
          .map((cell) => {
            if (
              cell.includes(',') ||
              cell.includes('"') ||
              cell.includes('\n')
            ) {
              return `"${cell.replace(/"/g, '""')}"`
            }
            // اگه فقط عدد هست، بدون "" بذار تا Excel فرمول نخونه
            return cell
          })
          .join(',')
      )
      .join('\n')

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
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}