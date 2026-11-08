import 'server-only'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  isValidIranMobile,
  normalizePhone,
  phoneHash,
  setPhoneSession,
} from '@/lib/sms/otp'
import { hashData } from '@/lib/utils/hash'
import { parseDeviceLabel } from '@/lib/device-info'
import { ensureActivationTx } from '@/lib/wallet/wallet'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

/**
 * تکمیل ثبت‌نام با دعوت‌نامه — POST { token, fullName, phone, orgId?, memberId? }
 * لینک دعوت (از QR یا پیام‌رسان) خودش مجوز است: تک‌مصرف + تاریخ انقضا.
 * احراز فوری است: مشتری با همان دستگاهی که لینک را باز کرده تأیید می‌شود
 * (کوکی نشست روی همان دستگاه ست می‌شود).
 * نوع عضویت در همان فرم انتخاب می‌شود: «general» (باشگاه عادی) یا شناسه سازمان؛
 * برای سازمانی، تطبیق با لیست اکسل انجام و عضویت فعال می‌شود (یا درخواست بررسی دستی ثبت می‌شود).
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'register-complete', 5, 10 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim().slice(0, 120) : ''
    const phone = normalizePhone(body?.phone)
    const orgId = typeof body?.orgId === 'string' ? body.orgId.trim() : 'general'
    const memberId = typeof body?.memberId === 'string' ? body.memberId.trim().slice(0, 40) : ''

    if (!token || token.length > 64 || fullName.length < 3 || !isValidIranMobile(phone)) {
      return NextResponse.json(
        { error: 'نام و شماره موبایل معتبر لازم است' },
        { status: 400 }
      )
    }
    if (orgId !== 'general' && !UUID_RE.test(orgId)) {
      return NextResponse.json({ error: 'نوع عضویت نامعتبر است' }, { status: 400 })
    }
    if (orgId !== 'general' && !memberId) {
      return NextResponse.json(
        { error: 'برای عضویت سازمانی، شماره دانشجویی/پرسنلی الزامی است' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // ۱) دعوت‌نامه باید فعال، مصرف‌نشده و داخل مهلت باشد
    const { data: invite, error: invErr } = await db
      .from('registration_invites')
      .select('id, expires_at, used_at, is_active')
      .eq('token', token)
      .maybeSingle()

    if (invErr || !invite || !invite.is_active || invite.used_at) {
      return NextResponse.json({ error: 'این لینک قبلاً استفاده شده یا باطل شده است' }, { status: 409 })
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'مهلت این لینک تمام شده است؛ از مدیر لینک جدید بگیر' }, { status: 410 })
    }

    // ۲) شناسنامه‌ی دستگاه — کوکی موجود یا ساختِ جدید؛ مبنای تشخیص ثبت‌نام تکراری
    const ua = req.headers.get('user-agent') || ''
    const deviceLabel = parseDeviceLabel(ua)
    const cookieStore = await cookies()
    let deviceToken = cookieStore.get('cafe_device_token')?.value || ''
    if (!deviceToken || deviceToken.length > 100) {
      deviceToken = crypto.randomUUID()
      cookieStore.set('cafe_device_token', deviceToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
      })
    }
    const deviceHash = hashData(deviceToken)

    // ۳) جلوگیری از ثبت‌نام تکراری — شماره موبایل و دستگاه
    const { data: existing } = await db
      .from('customers')
      .select('id, verification_status')
      .eq('phone', phone)
      .maybeSingle()

    if (existing?.verification_status === 'verified') {
      return NextResponse.json(
        { error: 'این شماره موبایل قبلاً ثبت‌نام کرده است؛ برای تغییر اطلاعات با مدیر کافه صحبت کنید' },
        { status: 409 }
      )
    }

    const { data: deviceOwner } = await db
      .from('customers')
      .select('id, phone')
      .eq('device_id_hash', deviceHash)
      .eq('verification_status', 'verified')
      .maybeSingle()
    if (deviceOwner && deviceOwner.phone !== phone) {
      return NextResponse.json(
        { error: 'این دستگاه قبلاً یکبار ثبت‌نام کرده است؛ برای اطلاعات بیشتر با مدیر کافه صحبت کنید' },
        { status: 409 }
      )
    }

    // ۴) مشتری: موجود → تکمیل اطلاعات و تأیید؛ جدید → ساختن (با شناسنامه‌ی دستگاه)
    const pHash = phoneHash(phone)
    let customerId: string
    if (existing?.id) {
      customerId = existing.id
      const { error: upErr } = await db
        .from('customers')
        .update({
          name: fullName,
          phone_hash: pHash,
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
          device_id_hash: deviceHash,
          device_info: deviceLabel,
        })
        .eq('id', customerId)
      if (upErr) {
        console.error('[register/complete] update:', upErr.message)
        return NextResponse.json({ error: 'تکمیل ثبت‌نام ناموفق بود' }, { status: 500 })
      }
    } else {
      const { data: inserted, error: insErr } = await db
        .from('customers')
        .insert({
          phone,
          phone_hash: pHash,
          name: fullName,
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
          device_id_hash: deviceHash,
          device_info: deviceLabel,
        })
        .select('id')
        .single()
      if (insErr || !inserted) {
        console.error('[register/complete] insert:', insErr?.message)
        return NextResponse.json({ error: 'تکمیل ثبت‌نام ناموفق بود' }, { status: 500 })
      }
      customerId = inserted.id
    }

    // ۵) عضویت باشگاه — نوعش در فرم دعوت انتخاب شده است
    let orgMembership: 'activated' | 'pending_review' | null = null
    let orgName: string | null = null
    if (orgId !== 'general') {
      const { data: orgRow } = await db.from('organizations').select('name').eq('id', orgId).single()
      orgName = orgRow?.name || null

      const nameHash = hashData(fullName)
      const memberIdHash = hashData(memberId)
      const orgPhoneHash = hashData(phone)

      // شماره دانشجویی/پرسنلی نباید قبلاً با شماره موبایل دیگری ثبت شده باشد
      const { data: dup } = await db
        .from('organization_members')
        .select('id, phone_hash')
        .eq('member_id_hash', memberIdHash)
        .eq('is_registered', true)
        .maybeSingle()
      if (dup && dup.phone_hash !== orgPhoneHash) {
        return NextResponse.json(
          { error: 'این شماره دانشجویی/پرسنلی قبلاً با شماره موبایل دیگری ثبت شده است' },
          { status: 409 }
        )
      }

      // تطبیق با لیست سازمان (اکسل آپلودشده توسط مدیر)
      const { data: memberArray, error: findErr } = await db
        .from('organization_members')
        .select('id, is_registered, metadata')
        .eq('organization_id', orgId)
        .eq('member_id_hash', memberIdHash)
        .eq('full_name_hash', nameHash)
        .limit(1)

      if (findErr) {
        console.error('[register/complete] org lookup:', findErr.message)
        return NextResponse.json({ error: 'خطا در بررسی لیست سازمان' }, { status: 500 })
      }

      const member = memberArray?.[0]
      if (!member) {
        const { error: reqErr } = await db.from('membership_requests').insert({
          full_name: fullName,
          phone,
          member_id: memberId,
          organization_name: orgName || 'سازمان ناشناس',
          status: 'pending',
        })
        if (reqErr) {
          console.error('[register/complete] membership request:', reqErr.message)
        }
        orgMembership = 'pending_review'
      } else {
        // عضویت با شماره تلفن تأییدشده گره می‌خورد — نه با دستگاه؛ تخفیف سازمانی
        // در چک‌اوت با همان شماره پیدا می‌شود و به دستگاه خاصی قفل نمی‌شود.
        const { error: upErr } = await db
          .from('organization_members')
          .update({
            phone_hash: orgPhoneHash,
            is_registered: true,
            registered_at: new Date().toISOString(),
            metadata: { ...(member.metadata || {}), _display_name: fullName, _phone: phone },
          })
          .eq('id', member.id)
        if (upErr) {
          console.error('[register/complete] org update:', upErr.message)
          return NextResponse.json({ error: 'فعال‌سازی عضویت سازمانی ناموفق بود' }, { status: 500 })
        }
        orgMembership = 'activated'
      }
    }

    // ۶) مصرف دعوت‌نامه — شرط used_at is null داخل UPDATE؛ رقابتِ دوباره‌فرستادن شکست می‌خورد
    const { data: used, error: useErr } = await db
      .from('registration_invites')
      .update({
        used_at: new Date().toISOString(),
        used_phone: phone,
        used_device_hash: deviceHash,
        used_device_info: deviceLabel,
      })
      .eq('id', invite.id)
      .is('used_at', null)
      .select('id')

    if (useErr || !used || used.length === 0) {
      return NextResponse.json(
        { error: 'این لینک همزمان جای دیگری استفاده شد' },
        { status: 409 }
      )
    }

    // ۷) تگ‌های CRM — تگ‌های قبلی حفظ می‌شوند
    try {
      const { data: custRow } = await db
        .from('customers')
        .select('tags')
        .eq('id', customerId)
        .maybeSingle()
      const currentTags = Array.isArray(custRow?.tags) ? custRow.tags : []
      const newTags = [...currentTags]
      if (orgId === 'general') {
        if (!newTags.includes('عضو باشگاه مشتریان')) newTags.push('عضو باشگاه مشتریان')
      } else {
        if (!newTags.includes('عضو باشگاه سازمانی')) newTags.push('عضو باشگاه سازمانی')
        if (orgName && !newTags.includes(`عضو ${orgName}`)) newTags.push(`عضو ${orgName}`)
      }
      await db.from('customers').update({ tags: newTags }).eq('id', customerId)
    } catch (crmErr) {
      console.error('[register/complete] crm tags:', crmErr)
    }

    // ۸) نشست تأییدشده روی همین دستگاه + رویداد فعال‌سازی
    await setPhoneSession(phone)
    await ensureActivationTx(customerId)

    return NextResponse.json({ ok: true, orgMembership })
  } catch (err) {
    console.error('[register/complete]', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
