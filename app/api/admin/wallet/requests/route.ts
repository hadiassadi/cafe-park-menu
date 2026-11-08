import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { ensureActivationTx } from '@/lib/wallet/wallet'

export const dynamic = 'force-dynamic'

/** صف درخواست‌ها: فعال‌سازی حضوری + رسیدهای شارژ — GET */
export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-reqs-get', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  const db = supabaseAdmin()

  const [activation, charges] = await Promise.all([
    db
      .from('wallet_activation_requests')
      .select('id, customer_id, name, phone, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('wallet_charge_requests')
      .select('id, customer_id, amount, status, receipt_url, tracking_no, reject_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (activation.error) {
    console.error('[admin/wallet/requests] activation:', activation.error.message)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }

  // پرونده‌ی مشتری هر درخواست (وضعیت احراز/کیف پول) — با یک کوئری برای همه‌ی شماره‌ها
  const activationRows = activation.data ?? []
  const phones = activationRows.map((r) => r.phone).filter((p): p is string => !!p)
  const profileByPhone = new Map<string, { verification_status: string; wallet_blocked: boolean; device_info: string | null }>()
  if (phones.length > 0) {
    const { data: profiles } = await db
      .from('customers')
      .select('phone, verification_status, wallet_blocked, device_info')
      .in('phone', phones)
    for (const p of profiles ?? []) {
      profileByPhone.set(p.phone, {
        verification_status: p.verification_status,
        wallet_blocked: !!p.wallet_blocked,
        device_info: p.device_info ?? null,
      })
    }
  }

  const activationRequests = activationRows.map((r) => ({
    ...r,
    customer: r.phone ? profileByPhone.get(r.phone) ?? null : null,
  }))

  return NextResponse.json({
    activationRequests,
    chargeRequests: charges.error ? [] : charges.data ?? [],
  })
}

/** تأیید/رد درخواست — POST { id, type: 'activation', action: 'approve' | 'reject' } */
export async function POST(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-reqs-post', 30, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    const type = body?.type
    const action = body?.action

    if (!/^[0-9a-f-]{36}$/i.test(id) || type !== 'activation' || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // درخواست باید در وضعیت pending باشد (جلوی تأیید دوباره گرفته می‌شود)
    const { data: request } = await db
      .from('wallet_activation_requests')
      .select('id, customer_id, status')
      .eq('id', id)
      .maybeSingle()

    if (!request || request.status !== 'pending') {
      return NextResponse.json({ error: 'این درخواست قبلاً بررسی شده است' }, { status: 409 })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    if (action === 'approve') {
      // احراز فوری: پرچم مشتری + رویداد فعال‌سازی در دفتر
      const { error: custErr } = await db
        .from('customers')
        .update({ verification_status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', request.customer_id)
      if (custErr) {
        console.error('[admin/wallet/requests] customer update:', custErr.message)
        return NextResponse.json({ error: 'تأیید ناموفق بود' }, { status: 500 })
      }
      await ensureActivationTx(request.customer_id)
    }

    const { error: reqErr } = await db
      .from('wallet_activation_requests')
      .update({ status: newStatus, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (reqErr) {
      console.error('[admin/wallet/requests] request update:', reqErr.message)
      return NextResponse.json({ error: 'ثبت نتیجه ناموفق بود' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err) {
    console.error('[admin/wallet/requests] POST', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
