import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { getDeviceHash } from '@/lib/orders/owner'
import {
  OTP_MAX_ATTEMPTS,
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
  setPhoneSession,
  upsertVerifiedCustomer,
} from '@/lib/sms/otp'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'otp-verify', 10, 10 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const phone = normalizePhone(body?.phone)
    const code = String(body?.code ?? '').replace(/\D/g, '')

    if (!isValidIranMobile(phone) || code.length !== 6) {
      return NextResponse.json({ error: 'اطلاعات وارد شده معتبر نیست' }, { status: 400 })
    }

    const db = supabaseAdmin()
    const pHash = phoneHash(phone)
    const row = await getLatestOtp(db, pHash)
    const check = checkOtpRow(row, code)

    if (!check.ok) {
      // مکمل شمارنده‌ی تلاش‌ها: با هر کد اشتباه، شانس حدس کمتر می‌شود
      if (row && check.reason === 'mismatch') await bumpOtpAttempts(db, row)
      return NextResponse.json(
        { error: otpRejectMessage(check.reason), ...(check.reason === 'mismatch' ? { attemptsLeft: check.attemptsLeft } : {}) },
        { status: 400 }
      )
    }

    // مصرف اتمیک: اگر هم‌زمان درخواست دیگری کد را مصرف کرده باشد اینجا می‌بازد
    if (!row || !(await claimOtp(db, row.id))) {
      return NextResponse.json({ error: otpRejectMessage('not_found') }, { status: 400 })
    }

    const deviceIdHash = await getDeviceHash()
    await upsertVerifiedCustomer(db, phone, deviceIdHash)
    await setPhoneSession(phone)
    await cleanupPhoneOtps(db, pHash)

    console.log('[otp/verify] phone verified:', maskPhone(phone), `attempts used: ${row.attempts}/${OTP_MAX_ATTEMPTS}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[otp/verify]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
