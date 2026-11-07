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

// هدرریزِ IP: جلوی پر کردن کلیدها با درخواست‌های بی‌مغز گرفته شود
const IP_LIMIT = { limit: 20, windowMs: 10 * 60_000 }
// هر شماره: حداکثر ۳ کد در ۱۰ دقیقه (کنترل هزینه‌ی پیامک)
const PHONE_LIMIT = { limit: 3, windowMs: 10 * 60_000 }

export async function POST(req: NextRequest) {
  if (!rateLimit(req, 'otp-send-ip', IP_LIMIT.limit, IP_LIMIT.windowMs).ok) {
    return NextResponse.json({ error: 'درخواست‌های زیاد. کمی بعد دوباره تلاش کنید.' }, { status: 429 })
  }

  try {
    const body = await req.json().catch(() => null)
    const phone = normalizePhone(body?.phone)

    if (!isValidIranMobile(phone)) {
      return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
    }

    const rl = rateLimit(req, 'otp-send-phone', PHONE_LIMIT.limit, PHONE_LIMIT.windowMs, phone)
    if (!rl.ok) return tooMany(rl)

    const db = supabaseAdmin()
    const cfg = await fetchSmsConfig(db)
    if (cfg.error || !cfg.config) {
      return NextResponse.json({ error: cfg.error ?? 'پیامک تنظیم نشده است' }, { status: 503 })
    }

    const code = generateOtpCode()
    await storeOtp(db, phoneHash(phone), phoneHash(code))

    const sent = await sendOtpLookup(cfg.config, phone, code)
    if (!sent.ok) {
      // کد ذخیره‌شده بی‌اثر می‌ماند؛ شمارنده‌ی تلاش هم سمت شماره است
      return NextResponse.json({ error: sent.error ?? 'ارسال پیامک ناموفق بود' }, { status: 502 })
    }

    console.log('[otp/send] sent to', maskPhone(phone))
    return NextResponse.json({ ok: true, expiresInMin: OTP_TTL_MIN })
  } catch (err) {
    console.error('[otp/send]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
