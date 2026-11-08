import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getVerifiedPhoneHash } from '@/lib/sms/otp'
import { resolveCustomerByDevice } from '@/lib/wallet/wallet'

export const dynamic = 'force-dynamic'

/**
 * درخواست فعال‌سازی حضوری کیف پول از مدیر — POST { }
 * هویت: نشست OTP یا آخرین سفارش همین دستگاه (احراز لازم ندارد؛ درخواست فقط به ادمین می‌رود)
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'wallet-act-req', 3, 60 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const db = supabaseAdmin()

    let customer: { id: string; phone: string | null; name: string | null; verification_status: string } | null = null

    const phoneHash = await getVerifiedPhoneHash()
    if (phoneHash) {
      const { data } = await db
        .from('customers')
        .select('id, phone, name, verification_status')
        .eq('phone_hash', phoneHash)
        .maybeSingle()
      customer = data ?? null
    }
    if (!customer) {
      customer = await resolveCustomerByDevice()
    }

    if (!customer?.id) {
      return NextResponse.json(
        { error: 'برای ثبت درخواست، اول یک سفارش ثبت کن یا با شماره وارد شو' },
        { status: 400 }
      )
    }
    if (customer.verification_status === 'verified') {
      return NextResponse.json({ error: 'حساب شما قبلاً تأیید شده است' }, { status: 400 })
    }

    const { data: dup } = await db
      .from('wallet_activation_requests')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (dup) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    const { error } = await db.from('wallet_activation_requests').insert({
      customer_id: customer.id,
      name: customer.name ?? null,
      phone: customer.phone ?? null,
    })
    if (error) {
      console.error('[wallet/activation-request]', error.message)
      return NextResponse.json({ error: 'ثبت درخواست ناموفق بود' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[wallet/activation-request]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
