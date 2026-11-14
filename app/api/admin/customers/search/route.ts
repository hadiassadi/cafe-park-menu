import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-هـ: جستجوی سبک مشتری برای POS — تایپ نام یا شماره، حداکثر ۸ نتیجه.
// endpoint کامل /api/admin/customers همهٔ سفارش‌ها را برای آمار می‌خواند و برای
// جستجوی زندهٔ نوار POS مناسب نیست؛ اینجا فقط پروفایل لازم برمی‌گردد.

function normalizeDigits(v: unknown) {
  return String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-customer-search', 120, 60_000)
  if (!rl.ok) return tooMany(rl)

  const q = normalizeDigits(req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ customers: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // جستجو روی نام و شماره — ارقام فارسی/عربی قبلاً انگلیسی شده‌اند
  const digits = q.replace(/\D/g, '')
  const ors = [`name.ilike.%${q}%`]
  if (digits.length >= 2) ors.push(`phone.ilike.%${digits}%`)

  const { data, error } = await supabaseAdmin()
    .from('customers')
    .select('id, phone, name, verification_status')
    .is('archived_at', null)
    .or(ors.join(','))
    .order('name', { ascending: true })
    .limit(8)

  if (error) {
    console.error('[admin/customers/search]', error.message)
    return NextResponse.json({ error: 'خطا در جستجوی مشتری' }, { status: 500 })
  }

  return NextResponse.json(
    { customers: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
