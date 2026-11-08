import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { normalizePhone, isValidIranMobile } from '@/lib/sms/otp'
import { adminChargeByPhone, adminWalletByPhone, isValidWalletAmount } from '@/lib/wallet/wallet'

export const dynamic = 'force-dynamic'

/** نمای کیف پول یک مشتری برای ادمین: GET /api/admin/wallet?phone=09... */
export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-wallet-get', 30, 60_000)
  if (!rl.ok) return tooMany(rl)

  const phone = normalizePhone(req.nextUrl.searchParams.get('phone'))
  if (!isValidIranMobile(phone)) {
    return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
  }

  const view = await adminWalletByPhone(phone)
  if (!view) {
    return NextResponse.json({ error: 'مشتری با این شماره یافت نشد' }, { status: 404 })
  }
  return NextResponse.json(view)
}

/** شارژ دستی کیف پول مشتری توسط ادمین: POST { phone, amount, note } */
export async function POST(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-wallet-charge', 20, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const phone = normalizePhone(body?.phone)
    if (!isValidIranMobile(phone)) {
      return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
    }

    const amount = body?.amount
    if (!isValidWalletAmount(amount)) {
      return NextResponse.json(
        { error: 'مبلغ باید عدد صحیح بین ۵ هزار و ۱۰ میلیون تومان باشد' },
        { status: 400 }
      )
    }

    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) || null : null
    const res = await adminChargeByPhone(phone, amount, note)
    if (res.error) return NextResponse.json({ error: res.error }, { status: res.error.includes('یافت نشد') ? 404 : 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/wallet] POST', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
