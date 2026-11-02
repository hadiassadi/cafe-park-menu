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

const RESTORE_ERRORS: Record<string, { message: string; status: number }> = {
  order_not_found: { message: 'سفارش پیدا نشد', status: 404 },
  not_cancelled: { message: 'این سفارش لغو نشده است', status: 409 },
  not_admin_cancel: {
    message: 'فقط سفارش‌های لغوشده توسط مدیر قابل بازگردانی‌اند',
    status: 409,
  },
  restore_window_expired: {
    message: 'مهلت ۳۰ دقیقه‌ای بازگردانی تمام شده است. سفارش تازه ثبت کنید',
    status: 409,
  },
  has_refund: {
    message: 'برای این سفارش بازپرداخت ثبت شده و بازگردانی نمی‌شود. سفارش تازه ثبت کنید',
    status: 409,
  },
  membership_not_restorable: {
    message: 'سفارش دارای تخفیف باشگاه قابل بازگردانی نیست. سفارش تازه ثبت کنید',
    status: 409,
  },
  coupon_unavailable: {
    message: 'کوپن این سفارش دیگر معتبر نیست یا ظرفیتش پر شده است',
    status: 409,
  },
}

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

    let reason: string | null = null
    try {
      const body = await req.json()
      if (typeof body?.reason === 'string' && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 500)
      }
    } catch {
      // بدنه اختیاری است
    }

    const db = supabaseAdmin()
    const { data, error } = await db.rpc('restore_order_atomic', {
      p_order_id: id,
      p_restored_by: 'admin',
      p_reason: reason,
    })

    if (error) {
      const known = RESTORE_ERRORS[error.message?.trim()]
      if (known) {
        return NextResponse.json(
          { error: known.message },
          { status: known.status }
        )
      }
      return apiError(error, 'خطای پایگاه داده')
    }

    return NextResponse.json({ success: true, result: data })
  } catch (err: any) {
    return apiError(err)
  }
}
