import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/require-admin'

// ✅ متد PATCH برای ویرایش تنظیمات (همون که قبلا داشتیم)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const db = supabaseAdmin()

  const { error } = await db.from('organizations').update({
    discount_percent: body.discount_percent,
    max_daily_orders: body.max_daily_orders,
    max_total_orders: body.max_total_orders,
    expires_at: body.expires_at,
    is_active: body.is_active
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ✅ متد DELETE اصلاح‌شده برای حذف امن (اول اعضا، بعد سازمان)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params
    const db = supabaseAdmin()

    // ۱. ابتدا تمام اعضای این سازمان را پاک می‌کنیم
    const { error: membersError } = await db
      .from('organization_members')
      .delete()
      .eq('organization_id', id)

    if (membersError) {
      console.error('[Delete Members Error]', membersError)
      return NextResponse.json({ error: `خطا در حذف اعضا: ${membersError.message}` }, { status: 500 })
    }

    // ۲. سپس خود سازمان را پاک می‌کنیم
    const { error: orgError } = await db
      .from('organizations')
      .delete()
      .eq('id', id)

    if (orgError) {
      console.error('[Delete Org Error]', orgError)
      return NextResponse.json({ error: `خطا در حذف سازمان: ${orgError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
