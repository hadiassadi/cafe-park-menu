import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * بررسی دعوت‌نامه بدون مصرف آن — GET /api/register/invite?token=...
 * صفحه‌ی «تکمیل اطلاعات» با همین فهمید می‌شود که لینک سالم است یا نه.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(req, 'register-invite-get', 30, 60_000)
  if (!rl.ok) return tooMany(rl)

  const token = (req.nextUrl.searchParams.get('token') ?? '').trim()
  if (!token || token.length > 64) {
    return NextResponse.json({ valid: false, reason: 'invalid' })
  }

  const { data, error } = await supabaseAdmin()
    .from('registration_invites')
    .select('expires_at, used_at, is_active')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ valid: false, reason: 'not_found' })
  }
  if (!data.is_active) return NextResponse.json({ valid: false, reason: 'revoked' })
  if (data.used_at) return NextResponse.json({ valid: false, reason: 'used' })
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  return NextResponse.json({ valid: true })
}
