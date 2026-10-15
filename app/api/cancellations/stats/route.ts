import { NextResponse } from 'next/server'
import { getCancellationStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'month'

  const validFilters = ['today', 'week', 'month', 'all']
  if (!validFilters.includes(filter)) {
    return NextResponse.json(
      { error: 'فیلتر نامعتبر است' },
      { status: 400 }
    )
  }

  try {
    const data = await getCancellationStats(
      filter as 'today' | 'week' | 'month' | 'all'
    )
    return NextResponse.json(data)
  } catch (err) {
    console.error('[cancellation stats API] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}