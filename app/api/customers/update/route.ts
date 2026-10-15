import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, notes, tags } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'شماره تلفن الزامی است' },
        { status: 400 }
      )
    }

    const normalizedPhone = String(phone).replace(/[^\d]/g, '')
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'شماره تلفن نامعتبر' },
        { status: 400 }
      )
    }

    const db = await supabaseServer()

    const { data: existing } = await db
      .from('customers')
      .select('phone')
      .eq('phone', normalizedPhone)
      .maybeSingle()

    const updateData = {
      notes: notes || null,
      tags: Array.isArray(tags) ? tags : [],
    }

    let error

    if (existing) {
      const result = await db
        .from('customers')
        .update(updateData)
        .eq('phone', normalizedPhone)
      error = result.error
    } else {
      const result = await db.from('customers').insert({
        phone: normalizedPhone,
        ...updateData,
      })
      error = result.error
    }

    if (error) {
      console.error('[customer update] error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[customer update] error:', err)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}