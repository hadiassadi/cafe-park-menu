import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  CUSTOMER_COOKIE,
  SESSION_DAYS,
  generateSessionToken,
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
    const { phone, code } = await request.json()

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'شماره و کد الزامی است' },
        { status: 400 }
      )
    }

    const normalized = normalizePhone(phone)
    const db = createDb()

    // پیدا کردن آخرین کد معتبر برای این شماره
    const { data: session, error: findError } = await db
      .from('customer_sessions')
      .select('id, code, expires_at')
      .eq('phone', normalized)
      .is('verified_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError || !session) {
      return NextResponse.json(
        { error: 'کد منقضی شده. لطفاً دوباره درخواست بده.' },
        { status: 400 }
      )
    }

    if (session.code !== String(code).trim()) {
      return NextResponse.json(
        { error: 'کد وارد شده اشتباه است' },
        { status: 400 }
      )
    }

    // ساخت session token
    const token = generateSessionToken()
    const now = new Date()

    const { error: updateError } = await db
      .from('customer_sessions')
      .update({
        verified_at: now.toISOString(),
        session_token: token,
      })
      .eq('id', session.id)

    if (updateError) {
      console.error('[verify-otp] update error:', updateError)
      return NextResponse.json(
        { error: 'خطا در ثبت ورود' },
        { status: 500 }
      )
    }

    // ست کردن cookie
    const response = NextResponse.json({ success: true, phone: normalized })
    response.cookies.set(CUSTOMER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (err: any) {
    console.error('[verify-otp] error:', err)
    return NextResponse.json(
      { error: err?.message || 'خطای غیرمنتظره' },
      { status: 500 }
    )
  }
}