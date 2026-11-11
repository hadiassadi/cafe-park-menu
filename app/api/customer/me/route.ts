import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { hashData } from '@/lib/utils/hash'
import { getVerifiedPhoneHash } from '@/lib/sms/otp'
import { identityGet, identitySet, IDENTITY_TTL } from '@/lib/identity-cache'
import crypto from 'crypto'
import 'server-only'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۴۰ — کلاینت ادمین یک‌بار ساخته می‌شود (به‌جای هر درخواست)
let _db: SupabaseClient | null = null
function db(): SupabaseClient {
  if (_db) return _db
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  _db = createClient(url, key, { auth: { persistSession: false } })
  return _db
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const deviceToken = cookieStore.get('cafe_device_token')?.value
    if (!deviceToken) return NextResponse.json({ customer: null, membership: null })

    const deviceIdHashNew = hashData(deviceToken)
    const deviceIdHashOld = crypto.createHash('sha256').update(deviceToken).digest('hex')

    const conn = db()

    let customer: { name: string; phone: string } | null = null

    // ۰. نشست «شماره تأییدشده» (ثبت‌نام با لینک دعوت مدیر یا کد پیامکی) — اولویت دارد؛
    // مشتریِ تازه‌ثبت‌نام‌شده هنوز سفارشی ندارد و با دستگاه پیدا نمی‌شود.
    const verifiedHash = await getVerifiedPhoneHash()
    if (verifiedHash) {
      // 🎯 پچ ۴۰: کش هویت نشست تأییدشده (TTL ۵ دقیقه) — فقط نام/شماره
      const cached = identityGet<{ name: string; phone: string } | null>(`vid:${verifiedHash}`)
      if (cached !== null) {
        customer = cached
      } else {
        const { data: verifiedCustomer } = await conn
          .from('customers')
          .select('phone, name')
          .eq('phone_hash', verifiedHash)
          .eq('verification_status', 'verified')
          .maybeSingle()
        customer = verifiedCustomer
          ? { name: verifiedCustomer.name || 'کاربر', phone: verifiedCustomer.phone }
          : null
        identitySet(`vid:${verifiedHash}`, customer, IDENTITY_TTL.verifiedSession)
      }
    }

    // ۱. اطلاعات مشتری از آخرین سفارش — با کش هویت دستگاه (مثبت ۲ دقیقه / منفی ۲۰ ثانیه)
    if (!customer) {
      const cacheKey = `dev:${deviceIdHashNew}`
      const cachedDev = identityGet<{ name: string; phone: string } | null>(cacheKey)
      if (cachedDev !== null) {
        customer = cachedDev
      } else {
        const { data: orderData } = await conn
          .from('orders')
          .select('customer_name, customer_phone')
          .in('device_id_hash', [deviceIdHashOld, deviceIdHashNew])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        customer = orderData
          ? { name: orderData.customer_name, phone: orderData.customer_phone }
          : null
        identitySet(
          cacheKey,
          customer,
          customer ? IDENTITY_TTL.deviceIdentity : IDENTITY_TTL.deviceIdentityNegative
        )
      }
    }

    // ۲. چک کردن عضویت (اول با شماره تلفن، بعد با دستگاه)
    let membership = null
    let memberData = null
    let generalMember = null

    // اگر شماره تلفن داریم، با شماره تلفن توی جدول مشتریان و سازمان‌ها می‌گردیم
    if (customer && customer.phone) {
      const phoneHash = hashData(customer.phone)
      
      // چک کردن عضویت سازمانی با شماره تلفن
      const { data: m } = await conn
        .from('organization_members')
        .select('organization_id, metadata')
        .eq('phone_hash', phoneHash)
        .eq('is_registered', true)
        .maybeSingle()
      memberData = m

      // چک کردن عضویت عادی با شماره تلفن
      const { data: gm } = await conn
        .from('customers')
        .select('phone, name')
        .eq('phone', customer.phone)
        .maybeSingle()
      generalMember = gm
    } 
    
    // اگر با شماره تلفن پیدا نشد، با شناسه دستگاه می‌گردیم
    if (!memberData && !generalMember) {
      const { data: m } = await conn
        .from('organization_members')
        .select('organization_id, metadata')
        .in('device_id_hash', [deviceIdHashOld, deviceIdHashNew])
        .eq('is_registered', true)
        .maybeSingle()
      memberData = m

      const { data: gm } = await conn
        .from('customers')
        .select('phone, name')
        .in('device_id_hash', [deviceIdHashOld, deviceIdHashNew])
        .maybeSingle()
      generalMember = gm
    }

    if (memberData && memberData.organization_id) {
      // 🎯 پچ ۴۰: نام سازمان با کش (TTL ۵ دقیقه) — نام سازمان به‌ندرت عوض می‌شود
      const orgKey = `org:${memberData.organization_id}`
      let orgName = identityGet<string>(orgKey)
      if (orgName === null) {
        const { data: orgData } = await conn.from('organizations').select('name').eq('id', memberData.organization_id).single()
        orgName = orgData?.name ?? ''
        if (orgName) identitySet(orgKey, orgName, IDENTITY_TTL.orgName)
      }
      if (orgName) membership = { orgId: memberData.organization_id, orgName }
      if (!customer && memberData.metadata?._display_name) {
        customer = { name: memberData.metadata._display_name, phone: memberData.metadata._phone || '' }
      }
    } else if (generalMember) {
      membership = { orgId: 'general', orgName: 'باشگاه مشتریان کافه پارک' }
      if (!customer) customer = { name: generalMember.name || 'کاربر', phone: generalMember.phone }
    }

    return NextResponse.json({ customer, membership }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('ME API Error:', err)
    return NextResponse.json({ customer: null, membership: null }, { status: 500 })
  }
}