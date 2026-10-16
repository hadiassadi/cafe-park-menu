import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const orderId = formData.get('orderId') as string

    if (!file || !orderId) {
      return NextResponse.json({ error: 'فایل و orderId الزامی' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env')

    const db = createClient(url, key, { auth: { persistSession: false } })

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `receipt-${orderId}-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await db.storage
      .from('receipts')
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload-receipt]', uploadError)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    const { data: urlData } = db.storage.from('receipts').getPublicUrl(fileName)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}