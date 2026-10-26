import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import {
  verifyStepUpToken,
  getStepUpCookieName,
} from '@/lib/admin/stepup'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params

    // ۱. چک کردن step-up
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

    // ۲. چک کردن feature flag
    const { data: settings } = await db
      .from('settings')
      .select('admin_allow_delete_orders')
      .eq('id', 1)
      .maybeSingle()

    if (settings && settings.admin_allow_delete_orders === false) {
      return NextResponse.json(
        { error: 'حذف سفارش توسط مدیر غیرفعال شده است' },
        { status: 403 }
      )
    }

    // ۳. soft delete
    const { data, error } = await db
      .from('orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')

    if (error) {
      return apiError(error, 'خطای پایگاه داده')
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'سفارش یافت نشد یا قبلاً حذف شده' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return apiError(err)
  }
}
