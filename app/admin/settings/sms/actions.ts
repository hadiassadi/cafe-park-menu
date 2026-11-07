'use server'

import { revalidatePath } from 'next/cache'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchSmsConfig, sendOtpLookup } from '@/lib/sms/kavenegar'
import { isValidIranMobile, normalizePhone } from '@/lib/sms/otp'

export type SmsSettings = {
  sms_api_key: string | null
  sms_sender: string | null
  sms_otp_template: string | null
}

const SMS_FIELDS = 'sms_api_key, sms_sender, sms_otp_template'

// فقط همین فیلدها اجازه‌ی نوشته‌شدن دارند
const ALLOWED_KEYS = SMS_FIELDS.split(',').map((k) => k.trim())

export async function getSmsSettings(): Promise<{
  data?: SmsSettings
  error?: string
}> {
  const denied = await guardAdmin()
  if (denied) return denied

  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select(SMS_FIELDS)
    .eq('id', 1)
    .single()

  if (error) {
    console.error('[sms/settings] read failed:', error.message)
    return { error: 'خطا در خواندن تنظیمات' }
  }
  return { data }
}

export async function saveSmsSettings(
  input: Partial<Record<keyof SmsSettings, unknown>>
): Promise<{ ok?: boolean; error?: string }> {
  const denied = await guardAdmin()
  if (denied) return denied

  const patch: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_KEYS.includes(key)) continue
    const v = typeof value === 'string' ? value.trim() : value
    patch[key] = v === '' || v === undefined || v === null ? null : String(v)
  }

  if ('sms_api_key' in patch && patch.sms_api_key && patch.sms_api_key.length < 16) {
    return { error: 'کلید کاوه‌نگار معتبر نیست' }
  }
  if ('sms_otp_template' in patch && patch.sms_otp_template && !/^[\w-]{3,40}$/.test(patch.sms_otp_template)) {
    return { error: 'نام قالب فقط حروف، رقم، خط تیره و زیرخط' }
  }

  const { error } = await supabaseAdmin()
    .from('settings')
    .update(patch)
    .eq('id', 1)

  if (error) {
    console.error('[sms/settings] save failed:', error.message)
    return { error: 'ذخیره‌سازی ناموفق بود' }
  }

  revalidatePath('/admin/settings/sms')
  return { ok: true }
}

/** دکمه‌ی «ارسال پیامک آزمایشی»: کلید و قالب و خط را یک‌جا می‌آزماید */
export async function sendTestSms(
  phoneRaw: string
): Promise<{ ok?: boolean; error?: string }> {
  const denied = await guardAdmin()
  if (denied) return denied

  const phone = normalizePhone(phoneRaw)
  if (!isValidIranMobile(phone)) {
    return { error: 'شماره تلفن معتبر نیست' }
  }

  const cfg = await fetchSmsConfig(supabaseAdmin())
  if (cfg.error || !cfg.config) return { error: cfg.error ?? 'پیامک تنظیم نشده است' }

  const sent = await sendOtpLookup(cfg.config, phone, '123456')
  if (!sent.ok) return { error: sent.error ?? 'ارسال ناموفق بود' }

  return { ok: true }
}
