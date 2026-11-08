import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * حذف ثبت‌نام مشتری توسط مدیر — POST { phone }
 * گاردهای امنیتی:
 *  - فقط ادمین احرازشده
 *  - موجودی کیف پول باید صفر باشد (بازگشت وجه اول انجام شود)
 *  - تراکنش‌های دفتر کیف پول هم پاک می‌شوند تا ردیف یتیم نماند
 * سفارش‌ها دست‌نخورده می‌مانند (تاریخچه CRM حفظ می‌شود).
 */
export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const phone = typeof body?.phone === 'string' ? body.phone.replace(/[^\d]/g, '') : ''

    if (!/^09\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const { data: customer, error: custErr } = await db
      .from('customers')
      .select('id, name')
      .eq('phone', phone)
      .maybeSingle()

    if (custErr) {
      console.error('[customers/delete] read:', custErr.message)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }
    if (!customer) {
      return NextResponse.json({ error: 'ثبت‌نامی برای این شماره پیدا نشد' }, { status: 404 })
    }

    // موجودی کیف پول باید صفر باشد
    const { data: balance, error: balErr } = await db.rpc('wallet_balance', {
      p_customer_id: customer.id,
    })
    if (balErr) {
      console.error('[customers/delete] balance:', balErr.message)
      return NextResponse.json({ error: 'خواندن موجودی کیف پول ناموفق بود' }, { status: 500 })
    }
    if (Number(balance ?? 0) !== 0) {
      return NextResponse.json(
        { error: 'موجودی کیف پول این مشتری صفر نیست؛ اول بازگشت وجه بده یا موجودی را صفر کن' },
        { status: 409 }
      )
    }

    const { error: txErr } = await db
      .from('wallet_transactions')
      .delete()
      .eq('customer_id', customer.id)
    if (txErr) {
      console.error('[customers/delete] transactions:', txErr.message)
      return NextResponse.json({ error: 'حذف تراکنش‌های کیف پول ناموفق بود' }, { status: 500 })
    }

    const { error: delErr } = await db
      .from('customers')
      .delete()
      .eq('id', customer.id)
    if (delErr) {
      console.error('[customers/delete] delete:', delErr.message)
      return NextResponse.json({ error: 'حذف ثبت‌نام ناموفق بود' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[customers/delete]', err)
    return apiError(err)
  }
}
