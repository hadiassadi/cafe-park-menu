import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    return NextResponse.json({ error: 'فایلی ارسال نشد' }, { status: 400 })
  }

  // چک نوع فایل
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'فقط JPG, PNG, WEBP, GIF مجاز است' },
      { status: 400 }
    )
  }

  // چک حجم (حداکثر ۵ مگ)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'حجم فایل بیشتر از ۵ مگابایت است' },
      { status: 400 }
    )
  }

  // نام فایل یکتا
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `product-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await db.storage
    .from('product-images')
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
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

  return NextResponse.json({ url: publicUrl.publicUrl })
}