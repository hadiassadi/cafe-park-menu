import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { hashData } from '@/lib/utils/hash'
import { cookies } from 'next/headers'
import { rateLimit, tooMany } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// هم‌سو با app/api/orders/route.ts: نرمال‌سازی ارقام فارسی/عربی و فرمت 09xxxxxxxxx
function normalizePhone(v: unknown): string {
  let p = String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
  if (/^9\d{9}$/.test(p)) p = '0' + p
  return p
}

export async function POST(req: Request) {
  // بازدارنده‌ی اسپم ثبت‌نام: حداکثر ۱۰ درخواست در دقیقه از هر IP
  const rl = rateLimit(req, 'membership-register', 10, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json()
    const { fullName, memberId, orgId } = body

    if (!fullName || !body.phone || !orgId) {
      return NextResponse.json({ error: 'لطفاً همه فیلدهای ضروری را پر کنید' }, { status: 400 })
    }

    const cleanName = String(fullName).trim().slice(0, 60)
    if (!cleanName) {
      return NextResponse.json({ error: 'نام معتبر نیست' }, { status: 400 })
    }

    const phoneClean = normalizePhone(body.phone)
    if (!/^09\d{9}$/.test(phoneClean)) {
      return NextResponse.json({ error: 'شماره تلفن معتبر نیست' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    
    if (!deviceToken) {
      return NextResponse.json({ error: 'شناسه دستگاه یافت نشد. لطفاً یک بار سفارش دهید.' }, { status: 400 })
    }
    
    const deviceIdHash = hashData(deviceToken)
    const db = supabaseAdmin()

    // ═══════════════════════════════════════════════
    // حالت اول: مشتری عادی (باشگاه مشتریان)
    // ═══════════════════════════════════════════════
    if (orgId === 'general') {
      // ✅ چک می‌کنیم آیا این شماره تلفن قبلاً ثبت‌نام کرده است یا نه
      const { data: existingCustomer } = await db
        .from('customers')
        .select('device_id_hash, tags')
        .eq('phone', phoneClean)
        .maybeSingle()

      if (existingCustomer && existingCustomer.device_id_hash) {
        return NextResponse.json({ 
          error: 'شما یکبار ثبت‌نام کرده‌اید. برای استفاده از تخفیف باید از همان دستگاه قبلی (موبایل/تبلت/سیستم) استفاده کنید؛ در غیر این صورت تخفیفی تعلق نمی‌گیرد.' 
        }, { status: 400 })
      }

      // ✅ مدیریت تگ‌ها: تگ‌های قبلی رو پاک نکن، فقط تگ جدید رو اضافه کن
      const currentTags = existingCustomer?.tags || []
      const newTags = currentTags.includes('عضو باشگاه مشتریان')
        ? currentTags
        : [...currentTags, 'عضو باشگاه مشتریان']

      // اگر قبلاً ثبت‌نام نکرده بود، ثبت‌نام را انجام می‌دهیم
      const { error: custError } = await db.from('customers').upsert({
        phone: phoneClean,
        name: cleanName,
        device_id_hash: deviceIdHash,
        notes: `ثبت‌نام در باشگاه مشتریان`,
        tags: newTags,
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

    const nameHash = hashData(cleanName)
    const memberIdHash = hashData(memberId)
    const phoneHash = hashData(phoneClean)

    // ✅ ۱. چک می‌کنیم آیا این شماره دانشجویی قبلاً توسط کسی ثبت‌نام شده است یا نه
    const { data: existingMember } = await db
      .from('organization_members')
      .select('id')
      .eq('member_id_hash', memberIdHash)
      .eq('is_registered', true)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ 
        error: 'این شماره دانشجویی/پرسنلی قبلاً ثبت‌نام کرده است. برای استفاده از تخفیف باید از همان دستگاه قبلی استفاده کنید.' 
      }, { status: 400 })
    }

    // ✅ ۲. تطبیق با لیست اکسل
    const { data: memberArray, error: findError } = await db
      .from('organization_members')
      .select('id, is_registered, metadata')
      .eq('organization_id', orgId)
      .eq('member_id_hash', memberIdHash)
      .eq('full_name_hash', nameHash)
      .limit(1)

    if (findError) return NextResponse.json({ error: `خطای دیتابیس: ${findError.message}` }, { status: 500 })

    const member = memberArray && memberArray.length > 0 ? memberArray[0] : null

    // گرفتن نام سازمان برای استفاده در CRM
    const { data: org } = await db.from('organizations').select('name').eq('id', orgId).single()
    const orgName = org?.name || 'سازمان ناشناس'

    if (!member) {
      await db.from('membership_requests').insert({
        full_name: cleanName, phone: phoneClean, member_id: memberId,
        organization_name: orgName, status: 'pending'
      })
      return NextResponse.json({ success: false, message: 'اطلاعات شما در لیست سازمان یافت نشد. درخواست شما جهت بررسی دستی ثبت شد.' })
    }

    const newMetadata = {
      ...(member.metadata || {}),
      _display_name: cleanName,
      _phone: phoneClean
    }

    const { error: updateError } = await db.from('organization_members').update({
      device_id_hash: deviceIdHash, phone_hash: phoneHash, is_registered: true, registered_at: new Date().toISOString(), metadata: newMetadata
    }).eq('id', member.id)

    if (updateError) return NextResponse.json({ error: `خطا در فعال‌سازی: ${updateError.message}` }, { status: 500 })

    // ✅ ۳. ثبت خودکار در CRM (جدول مشتریان)
    try {
      const { data: existingCust } = await db.from('customers').select('tags').eq('phone', phoneClean).maybeSingle()

      const currentTags = existingCust?.tags || []
      const orgTag = `عضو ${orgName}`

      let newTags = [...currentTags]
      if (!newTags.includes('عضو باشگاه سازمانی')) newTags.push('عضو باشگاه سازمانی')
      if (!newTags.includes(orgTag)) newTags.push(orgTag)

      await db.from('customers').upsert({
        phone: phoneClean,
        name: cleanName,
        device_id_hash: deviceIdHash,
        notes: `ثبت‌نام در باشگاه سازمانی (${orgName})`,
        tags: newTags,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' })
    } catch (crmErr) {
      // اگر ثبت در CRM خطا داد، ثبت‌نام اصلی مشتری (B2B) رو متوقف نمی‌کنیم
      console.error('CRM Sync Error:', crmErr)
    }

    return NextResponse.json({ success: true, message: 'تبریک! عضویت شما فعال شد.' })
  } catch (err: any) {
    return NextResponse.json({ error: `خطای غیرمنتظره: ${err.message}` }, { status: 500 })
  }
}