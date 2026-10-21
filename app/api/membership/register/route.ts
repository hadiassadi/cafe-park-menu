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

    // ✅ ۱. چک کردن اینکه آیا این دستگاه قبلاً ثبت‌نام کرده است یا نه
    const { data: alreadyRegistered } = await db
      .from('organization_members')
      .select('id')
      .eq('device_id_hash', deviceIdHash)
      .eq('is_registered', true)
      .maybeSingle()

    const { data: alreadyGeneral } = await db
      .from('customers')
      .select('phone')
      .eq('device_id_hash', deviceIdHash)
      .maybeSingle()

    if (alreadyRegistered || alreadyGeneral) {
      return NextResponse.json({ 
        error: 'شما یکبار ثبت‌نام کرده‌اید. برای ثبت سفارش تخفیف‌دار سازمانی باید از همان دستگاه (موبایل، تبلت یا سیستم) استفاده کنید؛ در غیر این صورت هیچ تخفیفی به شما تعلق نخواهد گرفت.' 
      }, { status: 400 })
    }

        // ═══════════════════════════════════════════════
    // حالت اول: مشتری عادی (باشگاه مشتریان)
    // ═══════════════════════════════════════════════
    if (orgId === 'general') {
      const phoneClean = phone.trim()
      
      const { error: custError } = await db.from('customers').upsert({
        phone: phoneClean,
        name: fullName, // ✅ ذخیره اسم مشتری
        device_id_hash: deviceIdHash, 
        notes: `ثبت‌نام در باشگاه مشتریان`,
        tags: ['عضو باشگاه مشتریان'],
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' })

      if (custError) {
        console.error('General Register Error:', custError)
        return NextResponse.json({ error: 'خطا در ثبت‌نام باشگاه' }, { status: 500 })
      }
      return NextResponse.json({ success: true, message: 'تبریک! شما به باشگاه مشتریان کافه پارک پیوستید.' })
    }

    // ═══════════════════════════════════════════════
    // حالت دوم: سازمانی
    // ═══════════════════════════════════════════════
    if (!memberId) return NextResponse.json({ error: 'شماره دانشجویی/پرسنلی الزامی است' }, { status: 400 })

    const nameHash = hashData(fullName)
    const memberIdHash = hashData(memberId)
    const phoneHash = hashData(phone)

    const { data: memberArray, error: findError } = await db
      .from('organization_members')
      .select('id, is_registered, metadata')
      .eq('organization_id', orgId)
      .eq('member_id_hash', memberIdHash)
      .eq('full_name_hash', nameHash)
      .limit(1)

    if (findError) return NextResponse.json({ error: `خطای دیتابیس: ${findError.message}` }, { status: 500 })

    const member = memberArray && memberArray.length > 0 ? memberArray[0] : null

    if (!member) {
      const { data: org } = await db.from('organizations').select('name').eq('id', orgId).single()
      await db.from('membership_requests').insert({ 
        full_name: fullName, phone, member_id: memberId, 
        organization_name: org?.name || 'نامشخص', status: 'pending' 
      })
      return NextResponse.json({ success: false, message: 'اطلاعات شما در لیست سازمان یافت نشد. درخواست شما جهت بررسی دستی ثبت شد.' })
    }

    if (member.is_registered) return NextResponse.json({ error: 'این کد دانشجویی قبلاً توسط دستگاه دیگری ثبت‌نام شده است.' }, { status: 400 })

    const newMetadata = { 
      ...(member.metadata || {}), 
      _display_name: fullName, 
      _phone: phone 
    }

    const { error: updateError } = await db.from('organization_members').update({
      device_id_hash: deviceIdHash, phone_hash: phoneHash, is_registered: true, registered_at: new Date().toISOString(), metadata: newMetadata
    }).eq('id', member.id)

    if (updateError) return NextResponse.json({ error: `خطا در فعال‌سازی: ${updateError.message}` }, { status: 500 })

    return NextResponse.json({ success: true, message: 'تبریک! عضویت شما فعال شد.' })
  } catch (err: any) {
    return NextResponse.json({ error: `خطای غیرمنتظره: ${err.message}` }, { status: 500 })
  }
}