import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { getWalletView, resolveWalletCustomer } from '@/lib/wallet/wallet'

export const dynamic = 'force-dynamic'

/** کیف پول مشتری — نشست تأییدشده (OTP/دعوت) یا دستگاهِ مشتریِ احرازشده */
export async function GET(req: NextRequest) {
  const rl = rateLimit(req, 'wallet-get', 30, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const customer = await resolveWalletCustomer()
    if (!customer) {
      return NextResponse.json({ error: 'برای دیدن کیف پول باید با شماره موبایل وارد شوید' }, { status: 401 })
    }
    if (customer.wallet_blocked) {
      return NextResponse.json({ error: 'کیف پول شما توسط مدیر مسدود شده است' }, { status: 403 })
    }

    const view = await getWalletView(customer.id)
    return NextResponse.json(view)
  } catch (err) {
    console.error('[wallet] GET', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
