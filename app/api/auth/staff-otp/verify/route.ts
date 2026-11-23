import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { issueStaffShiftCookie } from '@/lib/admin/shift-auth'
import {
  bumpOtpAttempts,
  checkOtpRow,
  claimOtp,
  cleanupPhoneOtps,
  getLatestOtp,
  isValidIranMobile,
  maskPhone,
  normalizePhone,
  otpRejectMessage,
  phoneHash,
} from '@/lib/sms/otp'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۴ — تأیید کد پیامکی کارمند و صدور توکن شیفت (کوکی امضاشدهٔ ۱۲ ساعته).
// جلسهٔ پنلِ Supabase ساخته نمی‌شود؛ فقط دسترسی به عملیات شیفت از صفحهٔ /shift.
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'staff-otp-verify', 10, 10 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const phone = normalizePhone(body?.phone)
    const code = String(body?.code ?? '').replace(/\D/g, '')

    if (!isValidIranMobile(phone) || code.length !== 6) {
      return NextResponse.json(
        { error: 'اطلاعات وارد شده معتبر نیست' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()
    const pHash = phoneHash(phone)
    const row = await getLatestOtp(db, pHash)
    const check = checkOtpRow(row, code)

    if (!check.ok) {
      if (row && check.reason === 'mismatch') await bumpOtpAttempts(db, row)
      return NextResponse.json(
        {
          error: otpRejectMessage(check.reason),
          ...(check.reason === 'mismatch' ? { attemptsLeft: check.attemptsLeft } : {}),
        },
        { status: 400 }
      )
    }

    // مصرف اتمیک کد — اگر درخواست همزمانی کد را مصرف کرده باشد اینجا می‌بازد
    if (!row || !(await claimOtp(db, row.id))) {
      return NextResponse.json(
        { error: otpRejectMessage('not_found') },
        { status: 400 }
      )
    }

    // کارمند فعالِ متصل به اکانت پنل — مثل send
    const { data: rows } = await db
      .from('staff_members')
      .select('id, full_name, phone, auth_user_id')
      .eq('is_active', true)
      .not('auth_user_id', 'is', null)
    const staff = (rows ?? []).find(
      (r: any) =>
        r.auth_user_id && normalizePhone(String(r.phone ?? '')) === phone
    )
    if (!staff) {
      return NextResponse.json(
        { error: 'این شماره به کارمند فعالی با اکانت پنل متصل نیست' },
        { status: 404 }
      )
    }

    const { data: prof } = await db
      .from('admin_operator_profiles')
      .select('user_id')
      .eq('user_id', staff.auth_user_id)
      .maybeSingle()
    if (!prof) {
      return NextResponse.json(
        { error: 'پروفایل پنل این کارمند یافت نشد' },
        { status: 403 }
      )
    }

    await cleanupPhoneOtps(db, pHash)

    const res = NextResponse.json({
      ok: true,
      name: String(staff.full_name ?? 'کارمند'),
    })
    issueStaffShiftCookie(res, Number(staff.id), String(staff.auth_user_id))
    console.log('[staff-otp/verify] staff shift session issued:', maskPhone(phone))
    return res
  } catch (err) {
    console.error('[staff-otp/verify]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
