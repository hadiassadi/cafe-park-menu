import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * آرشیو / بازگردانی ثبت‌نام مشتری توسط مدیر — POST { phone, archive }
 *
 * آرشیو (archive: true):
 *  - archived_at ست می‌شود و از لیست مشتریان فعال و پنل مشتری مخفی می‌شود
 *  - verification_status به unverified برمی‌گردد → نشست و کیف پول همان لحظه غیرفعال می‌شود
 *  - سفارش‌ها، آمار و تاریخچه دست‌نخورده می‌مانند
 *  - اگر همان شماره/دستگاه با دعوت‌نامه‌ی جدید ثبت‌نام کند، حساب خودش دوباره زنده و تأیید می‌شود
 *
 * بازگردانی (archive: false):
 *  - archived_at خالی و حساب دوباره تأیید می‌شود
 */
export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const phone = typeof body?.phone === 'string' ? body.phone.replace(/[^\d]/g, '') : ''
    const archive = body?.archive !== false

    if (!/^09\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const { data: customer, error: custErr } = await db
      .from('customers')
      .select('id, name, verification_status, archived_at')
      .eq('phone', phone)
      .maybeSingle()

    if (custErr) {
      console.error('[customers/archive] read:', custErr.message)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }
    if (!customer) {
      return NextResponse.json({ error: 'ثبت‌نامی برای این شماره پیدا نشد' }, { status: 404 })
    }

    const now = new Date().toISOString()

    if (archive) {
      if (customer.archived_at) {
        return NextResponse.json({ error: 'این مشتری قبلاً آرشیو شده است' }, { status: 409 })
      }
      const { error: upErr } = await db
        .from('customers')
        .update({ archived_at: now, verification_status: 'unverified', updated_at: now })
        .eq('id', customer.id)
      if (upErr) {
        console.error('[customers/archive] archive:', upErr.message)
        return NextResponse.json({ error: 'آرشیو ناموفق بود' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, archived: true })
    }

    // بازگردانی
    if (!customer.archived_at) {
      return NextResponse.json({ error: 'این مشتری آرشیو نشده است' }, { status: 409 })
    }
    const { error: upErr } = await db
      .from('customers')
      .update({
        archived_at: null,
        verification_status: 'verified',
        verified_at: now,
        updated_at: now,
      })
      .eq('id', customer.id)
    if (upErr) {
      console.error('[customers/archive] restore:', upErr.message)
      return NextResponse.json({ error: 'بازگردانی ناموفق بود' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, archived: false })
  } catch (err) {
    console.error('[customers/archive]', err)
    return apiError(err)
  }
}
