import 'server-only'

// کلاینت کاوه‌نگار (فقط سمت سرور). کلید API از تنظیمات ادمین خوانده می‌شود
// و هرگز وارد لاگ یا پاسخ کلاینت نمی‌شود.

export type SmsConfig = {
  apiKey: string
  sender: string | null
  otpTemplate: string
}

type Db = ReturnType<typeof import('@/lib/supabase/server').supabaseAdmin>

const KAVENEGAR_BASE = 'https://api.kavenegar.com/v1'
const TIMEOUT_MS = 8_000

export async function fetchSmsConfig(db: Db): Promise<{ config?: SmsConfig; error?: string }> {
  const { data, error } = await db
    .from('settings')
    .select('sms_api_key, sms_sender, sms_otp_template')
    .eq('id', 1)
    .single()

  if (error) {
    console.error('[sms] settings read failed:', error.message)
    return { error: 'خطا در خواندن تنظیمات پیامک' }
  }

  const apiKey = data?.sms_api_key || process.env.KAVENEGAR_API_KEY || ''
  if (!apiKey) {
    return { error: 'پیامک تنظیم نشده است. کلید کاوه‌نگار را در پنل ادمین وارد کنید.' }
  }

  return {
    config: {
      apiKey,
      sender: data?.sms_sender || null,
      otpTemplate: data?.sms_otp_template || process.env.KAVENEGAR_OTP_TEMPLATE || 'cafe-park-otp',
    },
  }
}

/** ارسال کد OTP با قالب تأییدشده‌ی کاوه‌نگار (Verify Lookup) */
export async function sendOtpLookup(
  cfg: SmsConfig,
  phone: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const params = new URLSearchParams({
    receptor: phone,
    token,
    template: cfg.otpTemplate,
  })
  if (cfg.sender) params.set('sender', cfg.sender)

  try {
    const res = await fetch(`${KAVENEGAR_BASE}/${cfg.apiKey}/verify/lookup.json?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    const json = (await res.json().catch(() => null)) as
      | { return?: { status?: number; message?: string } }
      | null

    if (!json?.return) {
      console.error('[sms] kavenegar unparsable response, http:', res.status)
      return { ok: false, error: 'پاسخ نامعتبر از سرویس پیامک' }
    }

    if (json.return.status !== 200) {
      // کلید در لاگ نمی‌آید؛ فقط وضعیت و پیام سرویس
      console.error('[sms] kavenegar error:', json.return.status, json.return.message)
      return { ok: false, error: `خطای سرویس پیامک (${json.return.status})` }
    }

    return { ok: true }
  } catch (err) {
    console.error('[sms] kavenegar request failed:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد' }
  }
}

/** 🎯 پچ ۵۰-هـ-د: ارسال پیام ساده (Simple SMS) — برای لینک دعوت عضویت */
export async function sendSmsMessage(
  cfg: SmsConfig,
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const params = new URLSearchParams({ receptor: phone, message })
  if (cfg.sender) params.set('sender', cfg.sender)

  try {
    const res = await fetch(`${KAVENEGAR_BASE}/${cfg.apiKey}/sms/send.json?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    const json = (await res.json().catch(() => null)) as
      | { return?: { status?: number; message?: string } }
      | null

    if (!json?.return) {
      console.error('[sms] kavenegar unparsable response, http:', res.status)
      return { ok: false, error: 'پاسخ نامعتبر از سرویس پیامک' }
    }

    if (json.return.status !== 200) {
      console.error('[sms] kavenegar error:', json.return.status, json.return.message)
      return { ok: false, error: `خطای سرویس پیامک (${json.return.status})` }
    }

    return { ok: true }
  } catch (err) {
    console.error('[sms] kavenegar request failed:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد' }
  }
}
