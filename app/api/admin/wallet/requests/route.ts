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

  // پرونده‌ی مشتری رسیدهای شارژ — با یک کوئری روی شناسه‌ها
  const chargeRows = charges.error ? [] : charges.data ?? []
  const customerIds = [...new Set(chargeRows.map((r) => r.customer_id))]
  const profileById = new Map<string, { phone: string | null; name: string | null; wallet_blocked: boolean; card_charge_blocked: boolean }>()
  if (customerIds.length > 0) {
    const { data: profiles } = await db
      .from('customers')
      .select('id, phone, name, wallet_blocked, card_charge_blocked')
      .in('id', customerIds)
    for (const p of profiles ?? []) {
      profileById.set(p.id, {
        phone: p.phone ?? null,
        name: p.name ?? null,
        wallet_blocked: !!p.wallet_blocked,
        card_charge_blocked: !!p.card_charge_blocked,
      })
    }
  }

  const chargeRequests = chargeRows.map((r) => ({
    ...r,
    customer: profileById.get(r.customer_id) ?? null,
  }))

  return NextResponse.json({
    activationRequests,
    chargeRequests,
  })
}

/**
 * تأیید/رد درخواست — POST
 * { id, type: 'activation', action: 'approve' | 'reject' }
 * { id, type: 'charge', action: 'approve' | 'reject', reject_reason? }
 */
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

    if (!/^[0-9a-f-]{36}$/i.test(id) || !['activation', 'charge'].includes(type) || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }

    const db = supabaseAdmin()

    if (type === 'charge') return reviewChargeRequest(db, id, action, body?.reject_reason)

    // ---------- فعال‌سازی حضوری ----------
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

/** تأیید رسید شارژ: درج تراکنش receipt_charge با RPC؛ رد: ثبت دلیل. هر دو با گارد pending */
async function reviewChargeRequest(
  db: ReturnType<typeof supabaseAdmin>,
  id: string,
  action: 'approve' | 'reject',
  reasonRaw: unknown
): Promise<NextResponse> {
  // اول درخواست را «قفل» می‌کنیم (UPDATE گارددار) تا دو ادمین هم‌زمان دوبار شارژ نزنند
  const rejectReason =
    action === 'reject' && typeof reasonRaw === 'string' && reasonRaw.trim()
      ? reasonRaw.trim().slice(0, 200)
      : null

  const { data: claimed, error: claimErr } = await db
    .from('wallet_charge_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reject_reason: rejectReason,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('customer_id, amount, tracking_no')

  if (claimErr) {
    console.error('[admin/wallet/requests] charge claim:', claimErr.message)
    return NextResponse.json({ error: 'ثبت نتیجه ناموفق بود' }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'این درخواست قبلاً بررسی شده است' }, { status: 409 })
  }

  const request = claimed[0]

  if (action === 'approve') {
    // استثنای هر مشتری: شارژ کارت‌به‌کارتِ مسدودشده تأیید نمی‌شود
    const { data: cust } = await db
      .from('customers')
      .select('card_charge_blocked')
      .eq('id', request.customer_id)
      .maybeSingle()
    if (cust?.card_charge_blocked) {
      // برگرداندن به صف تا ادمین بعد از رفع مسدودی دوباره تصمیم بگیرد
      await db
        .from('wallet_charge_requests')
        .update({ status: 'pending', reviewed_at: null })
        .eq('id', id)
      return NextResponse.json(
        { error: 'شارژ کارت‌به‌کارت این مشتری مسدود است؛ از «پرونده» غیرفعالش کن یا درخواست را رد کن' },
        { status: 409 }
      )
    }

    const amount = Number(request.amount)
    const note = `شارژ با تأیید رسید${request.tracking_no ? ` — پیگیری: ${request.tracking_no}` : ''}`
    const { error: txErr } = await db.rpc('wallet_charge', {
      p_customer_id: request.customer_id,
      p_amount: amount,
      p_kind: 'receipt_charge',
      p_note: note,
    })
    if (txErr) {
      console.error('[admin/wallet/requests] receipt_charge rpc:', txErr.message)
      // تراکنش ثبت نشد — درخواست به صف برمی‌گردد
      await db
        .from('wallet_charge_requests')
        .update({ status: 'pending', reviewed_at: null })
        .eq('id', id)
      return NextResponse.json({ error: 'ثبت تراکنش شارژ ناموفق بود' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, status: action === 'approve' ? 'approved' : 'rejected' })
}
