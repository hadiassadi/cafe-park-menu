import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchSmsConfig, sendSmsMessage } from '@/lib/sms/kavenegar'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-هـ-د: ارسال لینک دعوت عضویت با پیامک برای مهمانِ حاضر در POS.
// GET  → فقط وضعیت تنظیمات پیامک (دکمه تا کامل‌شدن تنظیمات غیرفعال می‌ماند)
// POST → { token, phone } — ارسال لینک ثبت‌نام به شمارهٔ مهمان

function normalizePhone(v: unknown): string {
  let p = String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
  if (/^9\d{9}$/.test(p)) p = '0' + p
  return p
}

export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-invite-sms-status', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const { config, error } = await fetchSmsConfig(supabaseAdmin())
    return NextResponse.json(
      { configured: !!config, error: config ? null : error ?? null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[admin invites sms] status:', err)
    return NextResponse.json({ configured: false, error: 'خطای سرور' })
  }
}

export async function POST(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-invite-sms-send', 10, 10 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const phone = normalizePhone(body?.phone)

    if (!token || token.length > 64 || !/^09\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: 'شمارهٔ موبایل مهمان معتبر نیست — اول در ردیف مشتری واردش کن' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // دعوت‌نامه باید فعال و داخل مهلت باشد
    const { data: invite } = await db
      .from('registration_invites')
      .select('id, expires_at, used_at, is_active')
      .eq('token', token)
      .maybeSingle()
    if (!invite || !invite.is_active || invite.used_at) {
      return NextResponse.json({ error: 'این دعوت‌نامه معتبر نیست' }, { status: 409 })
    }

    const url = `${req.nextUrl.origin}/register/${token}`
    const expDate = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(invite.expires_at))
    const message = `☕ کافه پارک\nلینک ثبت‌نام عضویت:\n${url}\nمهلت: ${expDate}`

    const { config, error: cfgErr } = await fetchSmsConfig(db)
    if (!config) {
      return NextResponse.json(
        { error: cfgErr || 'پیامک تنظیم نشده است' },
        { status: 400 }
      )
    }

    const sent = await sendSmsMessage(config, phone, message)
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error || 'ارسال پیامک ناموفق بود' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin invites sms] send:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
