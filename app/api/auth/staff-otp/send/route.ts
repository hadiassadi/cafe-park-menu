import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { fetchSmsConfig, sendOtpLookup } from '@/lib/sms/kavenegar'
import {
  OTP_TTL_MIN,
  generateOtpCode,
  isValidIranMobile,
  maskPhone,
  normalizePhone,
  phoneHash,
  storeOtp,
} from '@/lib/sms/otp'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۶۴ — ارسال کد ورود شیفت برای کارمند: فقط شماره‌ای که در staff_members
// فعال است و به اکانت پنل (auth_user_id) متصل است کد می‌گیرد؛ بقیهٔ شماره‌ها
// بدون ارسال پیامک رد می‌شوند (بدون افشای جزئیات).
const IP_LIMIT = { limit: 10, windowMs: 10 * 60_000 }
const PHONE_LIMIT = { limit: 3, windowMs: 10 * 60_000 }

export async function POST(req: NextRequest) {
  if (!rateLimit(req, 'staff-otp-send-ip', IP_LIMIT.limit, IP_LIMIT.windowMs).ok) {
    return NextResponse.json(
      { error: 'درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json().catch(() => null)
    const phone = normalizePhone(body?.phone)

    if (!isValidIranMobile(phone)) {
      return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
    }

    const rl = rateLimit(req, 'staff-otp-send-phone', PHONE_LIMIT.limit, PHONE_LIMIT.windowMs, phone)
    if (!rl.ok) return tooMany(rl)

    const db = supabaseAdmin()

    // فقط کارمند فعالِ متصل به اکانت پنل — مقایسه با normalizePhone
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
      .select('user_id, is_active')
      .eq('user_id', staff.auth_user_id)
      .maybeSingle()
    if (!prof || prof.is_active === false) {
      return NextResponse.json(
        { error: 'پروفایل پنل این کارمند فعال نیست' },
        { status: 403 }
      )
    }

    const cfg = await fetchSmsConfig(db)
    if (cfg.error || !cfg.config) {
      console.error('[staff-otp/send] sms not configured:', cfg.error)
      return NextResponse.json(
        { error: 'ارسال پیامک فعلاً غیرفعال است؛ از مدیر کافه کمک بگیرید' },
        { status: 503 }
      )
    }

    const code = generateOtpCode()
    await storeOtp(db, phoneHash(phone), phoneHash(code))

    const sent = await sendOtpLookup(cfg.config, phone, code)
    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.error ?? 'ارسال پیامک ناموفق بود' },
        { status: 502 }
      )
    }

    console.log('[staff-otp/send] sent to', maskPhone(phone))
    return NextResponse.json({ ok: true, expiresInMin: OTP_TTL_MIN })
  } catch (err) {
    console.error('[staff-otp/send]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
