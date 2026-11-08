import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const WALLET_SETTING_FIELDS =
  'wallet_card_charge_enabled, wallet_charge_min, wallet_charge_max, payment_transfer_bank_name, payment_transfer_card_number, payment_transfer_account_holder'

/** تنظیمات کیف پول برای پنل ادمین — GET */
export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-wallet-set-get', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select(WALLET_SETTING_FIELDS)
    .eq('id', 1)
    .single()

  if (error) {
    console.error('[admin/wallet/settings] GET:', error.message)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/** ذخیره‌ی سوییچ‌های سراسری — POST { wallet_card_charge_enabled, wallet_charge_min, wallet_charge_max } */
export async function POST(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-wallet-set-post', 30, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)

    const patch: {
      wallet_card_charge_enabled?: boolean
      wallet_charge_min?: number
      wallet_charge_max?: number
    } = {}

    if (typeof body?.wallet_card_charge_enabled === 'boolean') {
      patch.wallet_card_charge_enabled = body.wallet_card_charge_enabled
    }

    for (const key of ['wallet_charge_min', 'wallet_charge_max'] as const) {
      const v = body?.[key]
      if (v === undefined || v === null || v === '') continue
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1_000 || n > 100_000_000) {
        return NextResponse.json(
          { error: 'کف/سقف شارژ باید عددی بین ۱٬۰۰۰ و ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد' },
          { status: 400 }
        )
      }
      patch[key] = n
    }

    if (
      patch.wallet_charge_min !== undefined &&
      patch.wallet_charge_max !== undefined &&
      patch.wallet_charge_min > patch.wallet_charge_max
    ) {
      return NextResponse.json({ error: 'کف شارژ نمی‌تواند از سقف بیشتر باشد' }, { status: 400 })
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'هیچ فیلد معتبری ارسال نشده است' }, { status: 400 })
    }

    const { error } = await supabaseAdmin().from('settings').update(patch).eq('id', 1)
    if (error) {
      console.error('[admin/wallet/settings] POST:', error.message)
      return NextResponse.json({ error: 'ذخیره ناموفق بود' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/wallet/settings] POST', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
