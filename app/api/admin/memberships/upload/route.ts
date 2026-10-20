import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orgName, discount, maxDaily, maxTotal, expiresAt, members } = body

    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'لیست اعضا خالی است' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // ۱. ثبت یا آپدیت سازمان
    const { data: org, error: orgError } = await db
      .from('organizations')
      .upsert({
        name: orgName,
        discount_percent: discount,
        max_daily_orders: maxDaily,
        max_total_orders: maxTotal,
        expires_at: expiresAt,
        is_active: true
      }, { onConflict: 'name' })
      .select()
      .single()

    if (orgError || !org) {
      console.error('Org Error:', orgError)
      return NextResponse.json({ error: 'خطا در ثبت اطلاعات سازمان' }, { status: 500 })
    }

    // ۲. هش کردن داده‌های اعضا
        const membersToInsert = members.map((m: any) => ({
      organization_id: org.id,
      full_name_hash: hashData(m.full_name),
      member_id_hash: hashData(m.member_id),
      phone_hash: m.phone ? hashData(m.phone) : '',
      metadata: { 
        ...m.metadata,
        _display_name: m.full_name,    // 👈 برای نمایش در پنل ادمین
        _display_member_id: m.member_id // 👈 برای نمایش در پنل ادمین
      },
    }))

    // ۳. پاک کردن لیست قبلی این سازمان (برای جلوگیری از تکرار در آپدیت‌ها)
    await db.from('organization_members').delete().eq('organization_id', org.id)

    // ۴. درج اعضای جدید
    const { error: insertError } = await db.from('organization_members').insert(membersToInsert)

    if (insertError) {
            console.error('Insert Error:', insertError)
      return NextResponse.json({ error: `خطای دیتابیس: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `تعداد ${membersToInsert.length} نفر با موفقیت ثبت شدند.`
    })

  } catch (err: any) {
    console.error('[Upload Members] Error:', err)
    return NextResponse.json({ error: 'خطای غیرمنتظره در پردازش اطلاعات' }, { status: 500 })
  }
}