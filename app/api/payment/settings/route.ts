import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db
      .from('settings')
      .select(
        'payment_enabled, payment_online_enabled, payment_cash_enabled, payment_card_enabled, payment_transfer_enabled, payment_min_online_amount, payment_transfer_bank_name, payment_transfer_account_number, payment_transfer_card_number, payment_transfer_account_holder, payment_transfer_requires_review'
      )
      .eq('id', 1)
      .single()

    if (error) {
      console.error('[payment/settings]', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    return apiError(err)
  }
}
