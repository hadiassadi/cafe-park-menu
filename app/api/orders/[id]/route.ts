import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

// فقط ستون‌هایی که صفحه‌ی مشتری استفاده می‌کند
const CUSTOMER_COLUMNS = [
  'id',
  'order_number',
  'customer_name',
  'customer_phone',
  'table_number',
  'note',
  'items',
  'subtotal',
  'original_subtotal',
  'coupon_code',
  'coupon_discount',
  'eligible_subtotal',
  'ineligible_subtotal',
  'status',
  'created_at',
  'customer_confirmed',
  'cancellation_reason_label',
  'cancellation_note',
  'cancelled_by',
  'payment_method',
  'payment_status',
  'payment_ref_id',
  'payment_receipt_url',
  'payment_note',
].join(',')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()

    const { data, error } = await db
      .from('orders')
      .select(CUSTOMER_COLUMNS)
      .eq('id', id)
      .eq('device_id_hash', deviceHash)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    return NextResponse.json(
      { order: data },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('[api/orders/[id]] error:', err)
    return apiError(err)
  }
}
