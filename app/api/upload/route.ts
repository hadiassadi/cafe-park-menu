import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const db = await supabaseServer()

  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json(
      { error: 'فایلی ارسال نشد' },
      { status: 400 }
    )
  }

  // چک نوع فایل
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'image/gif',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'فقط JPG, PNG, WEBP, GIF مجاز است' },
      { status: 400 }
    )
  }

  // چک حجم (حداکثر ۱۰ مگ)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'حجم فایل بیشتر از ۱۰ مگابایت است' },
      { status: 400 }
    )
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // ✅ ریسایز + تبدیل به WebP
    const optimizedBuffer = await sharp(buffer)
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside', // حفظ نسبت
        withoutEnlargement: true, // بزرگ نکن
      })
      .webp({ quality: 85 })
      .toBuffer()

    // نام یکتا
    const fileName = `product-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.webp`

    const { error: uploadError } = await db.storage
      .from('product-images')
      .upload(fileName, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    const { data: publicUrl } = db.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: publicUrl.publicUrl,
      size: optimizedBuffer.length,
      originalSize: file.size,
    })
  } catch (error) {
    console.error('Image processing error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'خطا در پردازش عکس',
      },
      { status: 500 }
    )
  }
}