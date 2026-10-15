import { NextResponse } from 'next/server'
import { getActiveReasons } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('target') || 'customer'

  if (!['customer', 'admin'].includes(target)) {
    return NextResponse.json(
      { error: 'نوع نامعتبر' },
      { status: 400 }
    )
  }

  try {
    const reasons = await getActiveReasons(
      target as 'customer' | 'admin'
    )
    return NextResponse.json({ reasons })
  } catch (err) {
    console.error('[cancellation-reasons API] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}