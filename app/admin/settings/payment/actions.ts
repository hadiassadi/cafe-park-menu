'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { assertAdmin } from '@/lib/admin/assert-admin'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type PaymentSettings = {
  payment_enabled: boolean
  payment_online_enabled: boolean
  payment_cash_enabled: boolean
  payment_card_enabled: boolean
  payment_transfer_enabled: boolean
  payment_gateway: string
  payment_merchant_id: string | null // ✅ برگشت
  payment_sandbox_mode: boolean
  payment_min_online_amount: number
  payment_transfer_bank_name: string | null
  payment_transfer_account_number: string | null
  payment_transfer_card_number: string | null
  payment_transfer_account_holder: string | null
  payment_transfer_requires_review: boolean
  payment_transfer_auto_verify: boolean
}

const PAYMENT_FIELDS =
  'payment_enabled, payment_online_enabled, payment_cash_enabled, payment_card_enabled, payment_transfer_enabled, payment_gateway, payment_merchant_id, payment_sandbox_mode, payment_min_online_amount, payment_transfer_bank_name, payment_transfer_account_number, payment_transfer_card_number, payment_transfer_account_holder, payment_transfer_requires_review, payment_transfer_auto_verify'

// فقط همین فیلدها اجازه‌ی نوشته‌شدن دارند
const ALLOWED_KEYS = PAYMENT_FIELDS.split(',').map((k) => k.trim())

export async function getPaymentSettings(): Promise<{
  data?: PaymentSettings
  error?: string
}> {
  try {
    await assertAdmin()

    const db = createAdminDb()
    const { data, error } = await db
      .from('settings')
      .select(PAYMENT_FIELDS)
      .eq('id', 1)
      .single()

    if (error) {
      console.error('[getPaymentSettings]', error)
      return { error: error.message }
    }

    return { data: data as unknown as PaymentSettings }
  } catch (err: any) {
    console.error('[getPaymentSettings] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()

    if (!settings || typeof settings !== 'object') {
      return { error: 'داده‌ی نامعتبر' }
    }

    if (
      settings.payment_enabled &&
      !settings.payment_cash_enabled &&
      !settings.payment_card_enabled &&
      !settings.payment_online_enabled &&
      !settings.payment_transfer_enabled
    ) {
      return { error: 'حداقل یکی از روش‌های پرداخت باید فعال باشد' }
    }

    // حذف هر فیلد ناشناخته‌ای که از کلاینت آمده باشد
    const safe = Object.fromEntries(
      Object.entries(settings).filter(([k]) => ALLOWED_KEYS.includes(k))
    )

    if (Object.keys(safe).length === 0) {
      return { error: 'هیچ فیلد معتبری ارسال نشده است' }
    }

    const db = createAdminDb()
    const { error } = await db.from('settings').update(safe).eq('id', 1)

    if (error) {
      console.error('[updatePaymentSettings]', error)
      return { error: error.message }
    }

    revalidatePath('/admin/settings/payment')
    revalidatePath('/checkout')
    revalidatePath('/') // برای اپدیت منوی اصلی
    return { success: true }
  } catch (err: any) {
    console.error('[updatePaymentSettings] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
