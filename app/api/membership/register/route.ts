import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { fullName, memberId, phone, orgId } = body

    if (!fullName || !phone || !orgId) {
      return NextResponse.json({ error: 'لطفاً همه فیلدهای ضروری را پر کنید' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    
    if (!deviceToken) {
      return NextResponse.json({ error: 'شناسه دستگاه یافت نشد. لطفاً یک بار سفارش دهید.' }, { status: 400 })
    }
    
    const deviceIdHash = hashData(deviceToken)
    const db = supabaseAdmin()

    // ═══════════════════════════════════════════════
    // حالت اول: مشتری عادی (باشگاه مشتریان کافه پارک)
    // ═══════════════════════════════════════════════
    if (orgId === 'general') {
      const phoneClean = phone.trim()
      
      const { error: custError } = await db.from('customers').upsert({
        phone: phoneClean,
        notes: `ثبت‌نام در باشگاه مشتریان (دستگاه: ${deviceIdHash.substring(0, 8)}...)`,
        tags: ['عضو باشگاه مشتریان'],
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' })

      if (custError) {
        console.error('General Register Error:', custError)
        return NextResponse.json({ error: 'خطا در ثبت‌نام باشگاه' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'تبریک! شما به باشگاه مشتریان کافه پارک پیوستید.' 
      })
    }

    // ═══════════════════════════════════════════════
    // حالت دوم: ثبت‌نام سازمانی (دانشگاه/شرکت)
    // ═══════════════════════════════════════════════
    if (!memberId) {
      return NextResponse.json({ error: 'شماره دانشجویی/پرسنلی الزامی است' }, { status: 400 })
    }

    const nameHash = hashData(fullName)
    const memberIdHash = hashData(memberId)
    const phoneHash = hashData(phone)

    const { data: member, error: findError } = await db
      .from('organization_members')
      .select('id, is_registered')
      .eq('organization_id', orgId)
      .eq('member_id_hash', memberIdHash)
      .eq('full_name_hash', nameHash)
      .maybeSingle()

    if (findError) {
      console.error('Find Error:', findError)
      return NextResponse.json({ error: 'خطا در سیستم' }, { status: 500 })
    }

    if (!member) {
      const { data: org } = await db.from('organizations').select('name').eq('id', orgId).single()
      await db.from('membership_requests').insert({
        full_name: fullName,
        phone: phone,
        member_id: memberId,
        organization_name: org?.name || 'نامشخص',
        status: 'pending'
      })
      return NextResponse.json({ 
        success: false, 
        message: 'اطلاعات شما در لیست سازمان یافت نشد. درخواست شما جهت بررسی دستی ثبت شد.' 
      })
    }

    if (member.is_registered) {
      return NextResponse.json({ error: 'این کد قبلاً در سیستم ثبت‌نام شده است.' }, { status: 400 })
    }

    const { error: updateError } = await db
      .from('organization_members')
      .update({
        device_id_hash: deviceIdHash,
        phone_hash: phoneHash,
        is_registered: true,
        registered_at: new Date().toISOString()
      })
      .eq('id', member.id)

    if (updateError) {
      return NextResponse.json({ error: 'خطا در فعال‌سازی تخفیف' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'تبریک! عضویت شما فعال شد. از این پس تخفیف به صورت خودکار اعمال می‌شود.' 
    })

  } catch (err: any) {
    console.error('[Register] Error:', err)
    return NextResponse.json({ error: 'خطای غیرمنتظره در سرور' }, { status: 500 })
  }
}