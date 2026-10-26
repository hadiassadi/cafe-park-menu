import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 5 * 1024 * 1024
const ORDER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

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
    const formData = await req.formData()
    const file = formData.get('file')
    const orderId = formData.get('orderId')

    if (!(file instanceof File) || typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ error: 'فایل و orderId الزامی' }, { status: 400 })
    }

    if (!ORDER_ID_RE.test(orderId)) {
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

    const db = supabaseAdmin()

    // سفارش باید واقعاً وجود داشته باشد
    const { data: order } = await db
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()

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
      .createSignedUrl(fileName, 60 * 60 * 24 * 365)

    if (signError || !signedUrlData) {
      console.error('[upload-receipt] sign url error:', signError)
      return NextResponse.json({ error: 'خطا در ساخت لینک رسید' }, { status: 500 })
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })
  } catch (err) {
    console.error('[upload-receipt] unexpected:', err)
    return apiError(err)
  }
}
