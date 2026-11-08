import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveWalletCustomer, getWalletFlags } from '@/lib/wallet/wallet'
import {
  chargeAmountError,
  isChargeAmount,
  isValidTrackingNo,
  normalizeTrackingNo,
} from '@/lib/wallet/charge'
import { IMAGE_SIGNED_URL_TTL, MAX_IMAGE_SIZE, detectImage } from '@/lib/upload/image'

export const dynamic = 'force-dynamic'

/**
 * ثبت درخواست شارژ کارت‌به‌کارت توسط مشتری — POST multipart/form-data
 * فیلدها: amount (مبلغ به تومان)، tracking_no (شماره پیگیری)، file (عکس رسید)
 * درخواست در wallet_charge_requests با وضعیت pending می‌نشیند؛
 * شارژ واقعی کیف پول فقط بعد از تأیید ادمین انجام می‌شود.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'wallet-charge-req', 5, 60 * 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const customer = await resolveWalletCustomer()
    if (!customer) {
      return NextResponse.json(
        { error: 'برای ثبت درخواست شارژ، اول با شماره موبایل وارد شو' },
        { status: 401 }
      )
    }
    if (customer.wallet_blocked) {
      return NextResponse.json({ error: 'کیف پول شما توسط مدیر مسدود شده است' }, { status: 403 })
    }
    if (customer.card_charge_blocked) {
      return NextResponse.json(
        { error: 'شارژ کارت‌به‌کارت برای حساب شما غیرفعال است؛ با مدیر کافه تماس بگیر' },
        { status: 403 }
      )
    }

    const flags = await getWalletFlags()
    if (!flags.walletEnabled || !flags.cardChargeEnabled) {
      return NextResponse.json({ error: 'شارژ کارت‌به‌کارت در دسترس نیست' }, { status: 403 })
    }
    if (!flags.cardInfo) {
      return NextResponse.json(
        { error: 'شماره کارت مقصد تنظیم نشده است؛ با مدیر کافه تماس بگیر' },
        { status: 403 }
      )
    }

    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file')
    const amountRaw = formData?.get('amount')
    const trackingRaw = formData?.get('tracking_no')

    if (!(file instanceof File) || typeof amountRaw !== 'string' || typeof trackingRaw !== 'string') {
      return NextResponse.json({ error: 'مبلغ، شماره پیگیری و عکس رسید الزامی است' }, { status: 400 })
    }

    const amount = Number(normalizeTrackingNo(amountRaw))
    if (!isChargeAmount(amount, flags.chargeMin, flags.chargeMax)) {
      return NextResponse.json({ error: chargeAmountError(flags.chargeMin, flags.chargeMax) }, { status: 400 })
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

    // هر مشتری در هر لحظه فقط یک درخواست در انتظار تأیید دارد
    const { data: dup } = await db
      .from('wallet_charge_requests')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (dup) {
      return NextResponse.json(
        { error: 'شما یک درخواست شارژ در انتظار تأیید دارید' },
        { status: 409 }
      )
    }

    const buffer = new Uint8Array(await file.arrayBuffer())
    const detected = detectImage(buffer)
    if (!detected) {
      return NextResponse.json({ error: 'فقط عکس JPG، PNG یا WebP مجاز است' }, { status: 400 })
    }

    const fileName = `wallet-${customer.id}-${Date.now()}.${detected.ext}`
    const { error: uploadError } = await db.storage
      .from('receipts')
      .upload(fileName, buffer, { contentType: detected.mime, upsert: false })
    if (uploadError) {
      console.error('[wallet/charge-request] storage:', uploadError.message)
      return NextResponse.json({ error: 'خطا در ذخیره‌ی رسید' }, { status: 500 })
    }

    const { data: signed, error: signError } = await db.storage
      .from('receipts')
      .createSignedUrl(fileName, IMAGE_SIGNED_URL_TTL)
    if (signError || !signed) {
      console.error('[wallet/charge-request] sign:', signError?.message)
      await db.storage.from('receipts').remove([fileName])
      return NextResponse.json({ error: 'خطا در ساخت لینک رسید' }, { status: 500 })
    }

    const { error: insertError } = await db.from('wallet_charge_requests').insert({
      customer_id: customer.id,
      amount,
      status: 'pending',
      receipt_url: signed.signedUrl,
      tracking_no: trackingNo,
      paid_at: new Date().toISOString(),
    })
    if (insertError) {
      console.error('[wallet/charge-request] insert:', insertError.message)
      await db.storage.from('receipts').remove([fileName])
      return NextResponse.json({ error: 'ثبت درخواست ناموفق بود' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[wallet/charge-request] POST', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
