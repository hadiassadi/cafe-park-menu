import 'server-only'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const INVITE_TTL_DAYS = 7

/** فهرست دعوت‌نامه‌ها — GET /api/admin/wallet/invites */
export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-invites-get', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('registration_invites')
    .select('id, token, expires_at, used_at, used_phone, used_device_info, used_device_hash, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[admin/wallet/invites] GET', error.message)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
  return NextResponse.json({ invites: data ?? [] })
}

/** ساخت دعوت‌نامه جدید (QR / لینک) — POST { } */
export async function POST(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-invites-post', 20, 60_000)
  if (!rl.ok) return tooMany(rl)

  const token = crypto.randomBytes(9).toString('base64url') // ۱۲ کاراکتر امن در URL
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin()
    .from('registration_invites')
    .insert({ token, expires_at: expiresAt })
    .select('token, expires_at')
    .single()

  if (error || !data) {
    console.error('[admin/wallet/invites] POST', error?.message)
    return NextResponse.json({ error: 'ساخت دعوت‌نامه ناموفق بود' }, { status: 500 })
  }
  return NextResponse.json({ invite: data })
}

/** باطل کردن دعوت‌نامه — DELETE ?id= */
export async function DELETE(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'شناسه نامعتبر است' }, { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from('registration_invites')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('[admin/wallet/invites] DELETE', error.message)
    return NextResponse.json({ error: 'باطل‌سازی ناموفق بود' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
