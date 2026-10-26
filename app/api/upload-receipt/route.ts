import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const orderId = formData.get('orderId') as string

    if (!file || !orderId) {
      return NextResponse.json(
        { error: 'فایل و orderId الزامی' },
        { status: 400 }
      )
    }

    // ✅ چک کردن نوع و حجم فایل سمت سرور
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'فقط فایل عکس مجاز است' },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'حجم فایل نباید بیشتر از ۵ مگابایت باشد' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    // ✅ جلوگیری از اسم فایل با کاراکترهای غیرمجاز
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg'
    const fileName = `receipt-${orderId}-${Date.now()}.${safeExt}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    console.log('[upload-receipt] uploading:', {
      fileName,
      size: file.size,
      type: file.type,
      orderId,
    })

    const { error: uploadError } = await db.storage
      .from('receipts')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload-receipt] storage error:', uploadError)
      return NextResponse.json(
        { error: `خطای Storage: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // ✅ لینک امضا شده با اعتبار ۱ سال
    const { data: signedUrlData, error: signError } = await db.storage
      .from('receipts')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365)

    if (signError || !signedUrlData) {
      console.error('[upload-receipt] sign url error:', signError)
      return NextResponse.json(
        { error: 'خطا در ساخت لینک رسید' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })
  } catch (err: any) {
    console.error('[upload-receipt] unexpected:', err)
    return apiError(err)
  }
}