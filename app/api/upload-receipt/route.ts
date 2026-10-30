import { apiError } from '@/lib/api-error'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDeviceHash, UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 5 * 1024 * 1024
const SIGNED_URL_TTL = 60 * 60 * 24 * 30 // سی روز

function detectImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file')
    const orderId = formData?.get('orderId')

    if (!(file instanceof File) || typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ error: 'فایل و orderId الزامی' }, { status: 400 })
    }

    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'شناسه‌ی سفارش نامعتبر است' }, { status: 400 })
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'حجم فایل نباید بیشتر از ۵ مگابایت باشد' },
        { status: 400 }
      )
    }

    const buffer = new Uint8Array(await file.arrayBuffer())
    const detected = detectImage(buffer)
    if (!detected) {
      return NextResponse.json(
        { error: 'فقط عکس JPG، PNG یا WebP مجاز است' },
        { status: 400 }
      )
    }

    const deviceHash = await getDeviceHash()
    if (!deviceHash) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const db = supabaseAdmin()

    // سفارش باید متعلق به همین دستگاه و هنوز قابل ویرایش باشد
    const { data: order, error: findError } = await db
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('device_id_hash', deviceHash)
      .neq('payment_status', 'paid')
	  .eq('payment_method', 'transfer')
      .is('payment_receipt_url', null)
      .is('payment_note', null)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .is('deleted_at', null)
      .maybeSingle()

    if (findError) {
      console.error('[upload-receipt] find error:', findError)
      return apiError(findError, 'خطای پایگاه داده')
    }
    if (!order) {
      return NextResponse.json({ error: 'سفارش پیدا نشد' }, { status: 404 })
    }

    const fileName = `receipt-${orderId}-${Date.now()}.${detected.ext}`

    const { error: uploadError } = await db.storage
      .from('receipts')
      .upload(fileName, buffer, { contentType: detected.mime, upsert: false })

    if (uploadError) {
      console.error('[upload-receipt] storage error:', uploadError)
      return NextResponse.json({ error: 'خطا در آپلود رسید' }, { status: 500 })
    }

    const { data: signedUrlData, error: signError } = await db.storage
      .from('receipts')
      .createSignedUrl(fileName, SIGNED_URL_TTL)

    if (signError || !signedUrlData) {
      console.error('[upload-receipt] sign url error:', signError)
      await db.storage.from('receipts').remove([fileName])
      return NextResponse.json({ error: 'خطا در ساخت لینک رسید' }, { status: 500 })
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })
  } catch (err) {
    console.error('[upload-receipt] unexpected:', err)
    return apiError(err)
  }
}
