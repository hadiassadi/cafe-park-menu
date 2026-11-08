import 'server-only'
import { NextResponse } from 'next/server'
import { getWalletStatus } from '@/lib/wallet/wallet'

export const dynamic = 'force-dynamic'

/** وضعیت کیف پول برای پنل مشتری: پرچم‌ها + مشتریِ شناسایی‌شده + موجودی */
export async function GET() {
  try {
    const status = await getWalletStatus()
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[wallet/status]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
