import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ORDER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const MAX_NOTE = 500

// وضعیت‌هایی که دیگر نباید رسید جدید بگیرند (مقادیر را با پروژه‌ی خودتان تطبیق دهید)
const LOCKED_STATUSES = ['paid']


function isOwnReceiptUrl(raw: string, orderId: string): boolean {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return false
    const u = new URL(raw)
    const b = new URL(base)
    if (u.origin !== b.origin) return false
    const prefix = '/storage/v1/object/sign/receipts/'
    if (!u.pathname.startsWith(prefix)) return false
    const file = decodeURIComponent(u.pathname.slice(prefix.length))
    return file.startsWith(`receipt-${orderId}-`)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, receiptUrl, receiptNote } = body ?? {}

    if (typeof orderId !== 'string' || !ORDER_ID_RE.test(orderId)) {
      return NextResponse.json({ error: 'orderId نامعتبر' }, { status: 400 })
    }

    const hasUrl = typeof receiptUrl === 'string' && receiptUrl.length > 0
    const note = typeof receiptNote === 'string' ? receiptNote.trim() : ''

    if (!hasUrl && !note) {
      return NextResponse.json(
        { error: 'رسید یا توضیحات الزامی' },
        { status: 400 }
      )
    }

    if (hasUrl && !isOwnReceiptUrl(receiptUrl, orderId)) {
      return NextResponse.json({ error: 'لینک رسید نامعتبر است' }, { status: 400 })
    }

    if (note.length > MAX_NOTE) {
      return NextResponse.json({ error: 'توضیحات خیلی طولانی است' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const { data: order, error: findError } = await db
      .from('orders')
      .select('id, payment_status')
      .eq('id', orderId)
      .maybeSingle()

    if (findError) {
      return apiError(findError, 'خطای پایگاه داده')
    }
    if (!order) {
      return NextResponse.json({ error: 'سفارش یافت نشد' }, { status: 404 })
    }
    if (LOCKED_STATUSES.includes(order.payment_status)) {
      return NextResponse.json(
        { error: 'این سفارش دیگر قابل ویرایش رسید نیست' },
        { status: 409 }
      )
    }

    const updates: Record<string, any> = { payment_status: 'pending_review' }
    if (hasUrl) updates.payment_receipt_url = receiptUrl
    if (note) updates.payment_note = note

    const { error } = await db.from('orders').update(updates).eq('id', orderId)

    if (error) {
      console.error('[payment/upload-receipt] update error:', error)
      return apiError(error, 'خطای پایگاه داده')
    }

    console.log('[payment/upload-receipt] updated order', orderId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[payment/upload-receipt] unexpected:', err)
    return apiError(err)
  }
}
