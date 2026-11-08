import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  isValidIranMobile,
  normalizePhone,
  phoneHash,
  setPhoneSession,
} from '@/lib/sms/otp'
import { ensureActivationTx } from '@/lib/wallet/wallet'

export const dynamic = 'force-dynamic'

/**
 * تکمیل ثبت‌نام با دعوت‌نامه — POST { token, fullName, phone }
 * لینک دعوت (از QR یا پیام‌رسان) خودش مجوز است: تک‌مصرف + تاریخ انقضا.
 * احراز فوری است: مشتری با همان دستگاهی که لینک را باز کرده تأیید می‌شود
 * (کوکی نشست روی همان دستگاه ست می‌شود).
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'register-complete', 5, 10 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim().slice(0, 120) : ''
    const phone = normalizePhone(body?.phone)

    if (!token || token.length > 64 || fullName.length < 3 || !isValidIranMobile(phone)) {
      return NextResponse.json(
        { error: 'نام و شماره موبایل معتبر لازم است' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // ۱) دعوت‌نامه باید فعال، مصرف‌نشده و داخل مهلت باشد
    const { data: invite, error: invErr } = await db
      .from('registration_invites')
      .select('id, expires_at, used_at, is_active')
      .eq('token', token)
      .maybeSingle()

    if (invErr || !invite || !invite.is_active || invite.used_at) {
      return NextResponse.json({ error: 'این لینک قبلاً استفاده شده یا باطل شده است' }, { status: 409 })
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'مهلت این لینک تمام شده است؛ از مدیر لینک جدید بگیر' }, { status: 410 })
    }

    // ۲) مشتری: موجود → تکمیل اطلاعات و تأیید؛ جدید → ساختن
    const pHash = phoneHash(phone)
    const { data: existing } = await db
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    let customerId: string
    if (existing?.id) {
      customerId = existing.id
      const { error: upErr } = await db
        .from('customers')
        .update({
          name: fullName,
          phone_hash: pHash,
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .eq('id', customerId)
      if (upErr) {
        console.error('[register/complete] update:', upErr.message)
        return NextResponse.json({ error: 'تکمیل ثبت‌نام ناموفق بود' }, { status: 500 })
      }
    } else {
      const { data: inserted, error: insErr } = await db
        .from('customers')
        .insert({
          phone,
          phone_hash: pHash,
          name: fullName,
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (insErr || !inserted) {
        console.error('[register/complete] insert:', insErr?.message)
        return NextResponse.json({ error: 'تکمیل ثبت‌نام ناموفق بود' }, { status: 500 })
      }
      customerId = inserted.id
    }

    // ۳) مصرف دعوت‌نامه — شرط used_at is null داخل UPDATE؛ رقابتِ دوباره‌فرستادن شکست می‌خورد
    const { data: used, error: useErr } = await db
      .from('registration_invites')
      .update({ used_at: new Date().toISOString(), used_phone: phone })
      .eq('id', invite.id)
      .is('used_at', null)
      .select('id')

    if (useErr || !used || used.length === 0) {
      return NextResponse.json(
        { error: 'این لینک همزمان جای دیگری استفاده شد' },
        { status: 409 }
      )
    }

    // ۴) نشست تأییدشده روی همین دستگاه + رویداد فعال‌سازی
    await setPhoneSession(phone)
    await ensureActivationTx(customerId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[register/complete]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
