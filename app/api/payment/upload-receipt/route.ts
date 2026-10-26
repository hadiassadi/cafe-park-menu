import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { orderId, receiptUrl, receiptNote } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: 'orderId الزامی' }, { status: 400 })
    }

    if (!receiptUrl && !receiptNote) {
      return NextResponse.json(
        { error: 'رسید یا توضیحات الزامی' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    const updates: Record<string, any> = {
      payment_status: 'pending_review',
    }

    if (receiptUrl) {
      updates.payment_receipt_url = receiptUrl
      console.log('[upload-receipt] saving URL for order', orderId)
    } else {
      console.log('[upload-receipt] WARNING: No URL received, only text note saved')
    }

    if (receiptNote) {
      updates.payment_note = receiptNote
    }

    const { data, error } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select('id, payment_receipt_url')

    if (error) {
      console.error('[upload-receipt] update error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'سفارش یافت نشد' }, { status: 404 })
    }

    console.log('[upload-receipt] updated successfully:', data[0])
    return NextResponse.json({ success: true, updated: data[0] })
  } catch (err: any) {
    console.error('[upload-receipt] unexpected:', err)
    return apiError(err)
  }
}