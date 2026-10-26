import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { getSalesReport, type SalesReportFilter } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = (searchParams.get('filter') || 'month') as SalesReportFilter

    const data = await getSalesReport(filter)

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    console.error('[reports/sales] error:', err)
    return apiError(err)
  }
}