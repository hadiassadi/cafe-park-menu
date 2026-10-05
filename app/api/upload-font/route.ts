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
  const allowedExts = ['ttf', 'otf', 'woff', 'woff2']
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  if (!allowedExts.includes(ext)) {
    return NextResponse.json(
      { error: 'فقط TTF, OTF, WOFF, WOFF2 مجاز است' },
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

  // نام یکتا
  const fileName = `font-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await db.storage
    .from('theme-fonts')
    .upload(fileName, arrayBuffer, {
      contentType: file.type || 'font/ttf',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    )
  }

  const { data: publicUrl } = db.storage
    .from('theme-fonts')
    .getPublicUrl(fileName)

  return NextResponse.json({
    url: publicUrl.publicUrl,
    name: file.name,
    size: file.size,
    ext,
  })
}