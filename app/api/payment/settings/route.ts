import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const db = createDb()
    const { data, error } = await db
      .from('settings')
      .select(
        'payment_enabled, payment_online_enabled, payment_cash_enabled, payment_card_enabled, payment_transfer_enabled, payment_min_online_amount, payment_transfer_bank_name, payment_transfer_account_number, payment_transfer_card_number, payment_transfer_account_holder, payment_transfer_requires_review'
      )
      .eq('id', 1)
      .single()

    if (error) {
      console.error('[payment/settings]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}