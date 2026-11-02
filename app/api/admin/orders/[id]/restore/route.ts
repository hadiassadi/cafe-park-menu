import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { cookies } from 'next/headers'
import { verifyStepUpToken, getStepUpCookieName } from '@/lib/admin/stepup'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params
	const cookieStore = await cookies()
    const stepupToken = cookieStore.get(getStepUpCookieName())?.value
    if (!stepupToken) {
      return NextResponse.json(
        { error: 'تأیید امنیتی لازم است' },
        { status: 401 }
      )
    }
    const verified = await verifyStepUpToken(stepupToken)
    if (!verified) {
      return NextResponse.json(
        { error: 'جلسه تأیید امنیتی منقضی شده' },
        { status: 401 }
      )
    }

    const db = supabaseAdmin()

    const { data, error } = await db
      .from('orders')
      .update({ deleted_at: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select('id')

    if (error) {
      return apiError(error, 'خطای پایگاه داده')
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'سفارشی برای بازیابی پیدا نشد' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return apiError(err)
  }
}
