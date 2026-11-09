import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveWalletCustomer } from '@/lib/wallet/wallet'
import { getSubscriptionFlags } from '@/lib/subscriptions/subscriptions'
import {
  isValidTrackingNo,
  normalizeTrackingNo,
} from '@/lib/wallet/charge'
import { IMAGE_SIGNED_URL_TTL, MAX_IMAGE_SIZE, detectImage } from '@/lib/upload/image'
import { UUID_RE } from '@/lib/orders/owner'

export const dynamic = 'force-dynamic'

/**
 * درخواست خرید اشتراک با کارت‌به‌کارت — POST multipart/form-data
 * فیلدها: plan_id، tracking_no (شماره پیگیری)، file (عکس رسید)
 * درخواست در wallet_charge_requests با purpose='subscription' و وضعیت pending می‌نشیند؛
 * اشتراک واقعی فقط بعد از تأیید ادمین ساخته می‌شود (grant_subscription).
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'subscription-req', 5, 60 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const customer = await resolveWalletCustomer()
    if (!customer) {
      return NextResponse.json(
        { error: 'برای خرید اشتراک، اول با شماره موبایل وارد شو' },
        { status: 401 }
      )
    }
    if (customer.wallet_blocked) {
      return NextResponse.json({ error: 'کیف پول شما توسط مدیر مسدود شده است' }, { status: 403 })
    }
    if (customer.card_charge_blocked) {
      return NextResponse.json(
        { error: 'پرداخت کارت‌به‌کارت برای حساب شما غیرفعال است؛ با مدیر کافه تماس بگیر' },
        { status: 403 }
      )
    }

    const flags = await getSubscriptionFlags()
    if (!flags.subscriptionEnabled) {
      return NextResponse.json({ error: 'خرید اشتراک فعلاً فعال نیست' }, { status: 403 })
    }

    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file')
    const planIdRaw = formData?.get('plan_id')
    const trackingRaw = formData?.get('tracking_no')

    if (!(file instanceof File) || typeof planIdRaw !== 'string' || typeof trackingRaw !== 'string') {
      return NextResponse.json({ error: 'پلن، شماره پیگیری و عکس رسید الزامی است' }, { status: 400 })
    }
    if (!UUID_RE.test(planIdRaw)) {
      return NextResponse.json({ error: 'پلن نامعتبر است' }, { status: 400 })
    }

    const trackingNo = normalizeTrackingNo(trackingRaw)
    if (!isValidTrackingNo(trackingNo)) {
      return NextResponse.json(
        { error: 'شماره پیگیری باید ۴ تا ۳۰ رقم باشد' },
        { status: 400 }
      )
    }

    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'حجم عکس رسید نباید بیشتر از ۵ مگابایت باشد' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // پلن باید فعال باشد؛ مبلغ رسید = قیمت پلن در همین لحظه
    const { data: plan } = await db
      .from('subscription_plans')
      .select('id, name, price')
      .eq('id', planIdRaw)
      .eq('is_active', true)
      .maybeSingle()
    if (!plan) {
      return NextResponse.json({ error: 'این پلن در دسترس نیست' }, { status: 400 })
    }

    // هر مشتری در هر لحظه فقط یک درخواست در انتظار تأیید دارد (شارژ یا اشتراک)
    const { data: dup } = await db
      .from('wallet_charge_requests')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (dup) {
      return NextResponse.json(
        { error: 'شما یک درخواست در انتظار تأیید دارید' },
        { status: 409 }
      )
    }

    const buffer = new Uint8Array(await file.arrayBuffer())
    const detected = detectImage(buffer)
    if (!detected) {
      return NextResponse.json({ error: 'فقط عکس JPG، PNG یا WebP مجاز است' }, { status: 400 })
    }

    const fileName = `sub-${customer.id}-${Date.now()}.${detected.ext}`
    const { error: uploadError } = await db.storage
      .from('receipts')
      .upload(fileName, buffer, { contentType: detected.mime, upsert: false })
    if (uploadError) {
      console.error('[subscription/request] storage:', uploadError.message)
      return NextResponse.json({ error: 'خطا در ذخیره‌ی رسید' }, { status: 500 })
    }

    const { data: signed, error: signError } = await db.storage
      .from('receipts')
      .createSignedUrl(fileName, IMAGE_SIGNED_URL_TTL)
    if (signError || !signed) {
      console.error('[subscription/request] sign:', signError?.message)
      await db.storage.from('receipts').remove([fileName])
      return NextResponse.json({ error: 'خطا در ساخت لینک رسید' }, { status: 500 })
    }

    const { error: insertError } = await db.from('wallet_charge_requests').insert({
      customer_id: customer.id,
      amount: Number(plan.price),
      status: 'pending',
      receipt_url: signed.signedUrl,
      tracking_no: trackingNo,
      purpose: 'subscription',
      plan_id: plan.id,
      plan_name: plan.name,
      paid_at: new Date().toISOString(),
    })
    if (insertError) {
      console.error('[subscription/request] insert:', insertError.message)
      await db.storage.from('receipts').remove([fileName])
      return NextResponse.json({ error: 'ثبت درخواست ناموفق بود' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[subscription/request] POST', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
