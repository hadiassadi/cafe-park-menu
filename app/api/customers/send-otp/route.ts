import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  generateOtpCode,
  isValidIranianMobile,
  normalizePhone,
} from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone || !isValidIranianMobile(phone)) {
      return NextResponse.json(
        { error: 'شماره موبایل معتبر نیست (مثال: 09123456789)' },
        { status: 400 }
      )
    }

    const normalized = normalizePhone(phone)
    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // ۵ دقیقه

    const db = createDb()

    // پاک کردن کدهای قدیمی همین شماره
    await db
      .from('customer_sessions')
      .delete()
      .eq('phone', normalized)
      .is('verified_at', null)

    // درج کد جدید
    const { error } = await db.from('customer_sessions').insert({
      phone: normalized,
      code,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      console.error('[send-otp] insert error:', error)
      return NextResponse.json(
        { error: 'خطا در ارسال کد' },
        { status: 500 }
      )
    }

    // ⚠️ چون SMS نداریم، کد رو برمی‌گردونیم
    // بعداً که پنل SMS راه‌اندازی شد، این خط رو حذف کن
    return NextResponse.json({
      success: true,
      phone: normalized,
      code, // ← برای نمایش توی UI (نمایشی)
    })
  } catch (err: any) {
    console.error('[send-otp] error:', err)
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}