import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params
    const { action } = await req.json() // 'approve' یا 'reject'
    const db = supabaseAdmin()

    // ۱. خواندن اطلاعات درخواست
    const { data: request, error: reqError } = await db.from('membership_requests').select('*').eq('id', id).single()
    if (reqError || !request) return NextResponse.json({ error: 'درخواست یافت نشد' }, { status: 404 })

    if (action === 'reject') {
      // حذف درخواست
      await db.from('membership_requests').delete().eq('id', id)
      return NextResponse.json({ success: true, message: 'درخواست رد شد.' })
    }

    if (action === 'approve') {
      // ۲. پیدا کردن آیدی سازمان بر اساس نام
      const { data: org } = await db.from('organizations').select('id').eq('name', request.organization_name).single()
      if (!org) return NextResponse.json({ error: 'سازمان مربوطه یافت نشد' }, { status: 404 })

      // ۳. اضافه کردن به لیست اعضای سازمان
      const { error: insertError } = await db.from('organization_members').insert({
        organization_id: org.id,
        full_name_hash: hashData(request.full_name),
        member_id_hash: hashData(request.member_id),
        phone_hash: hashData(request.phone),
        is_registered: false, // کاربر باید یک بار دیگر فرم را پر کند تا دستگاهش ثبت شود
        metadata: {
          _display_name: request.full_name,
          _display_member_id: request.member_id
        }
      })

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

      // ۴. حذف درخواست از لیست بررسی
      await db.from('membership_requests').delete().eq('id', id)

      return NextResponse.json({ success: true, message: 'کاربر با موفقیت به لیست سازمان اضافه شد.' })
    }

    return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
