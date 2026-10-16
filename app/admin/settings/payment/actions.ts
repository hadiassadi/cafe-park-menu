'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

export type PaymentSettings = {
  payment_enabled: boolean
  payment_online_enabled: boolean
  payment_cash_enabled: boolean
  payment_card_enabled: boolean
  payment_transfer_enabled: boolean
  payment_gateway: string
  payment_merchant_id: string | null
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

export async function getPaymentSettings(): Promise<{
  data?: PaymentSettings
  error?: string
}> {
  try {
    const db = await supabaseServer()
    const { data, error } = await db
      .from('settings')
      .select(PAYMENT_FIELDS)
      .eq('id', 1)
      .single()

    if (error) {
      console.error('[getPaymentSettings]', error)
      return { error: error.message }
    }

    return { data: data as PaymentSettings }
  } catch (err: any) {
    console.error('[getPaymentSettings] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>
): Promise<{ success?: boolean; error?: string }> {
  try {
    // اعتبارسنجی
    if (
      settings.payment_enabled &&
      !settings.payment_cash_enabled &&
      !settings.payment_card_enabled &&
      !settings.payment_online_enabled &&
      !settings.payment_transfer_enabled
    ) {
      return {
        error: 'حداقل یکی از روش‌های پرداخت باید فعال باشد',
      }
    }

    if (
      settings.payment_enabled &&
      settings.payment_online_enabled &&
      !settings.payment_merchant_id &&
      !settings.payment_sandbox_mode
    ) {
      return {
        error: 'برای پرداخت آنلاین، Merchant ID لازم است',
      }
    }

    const db = await supabaseServer()
    const { error } = await db
      .from('settings')
      .update(settings)
      .eq('id', 1)

    if (error) {
      console.error('[updatePaymentSettings]', error)
      return { error: error.message }
    }

    revalidatePath('/admin/settings/payment')
    revalidatePath('/checkout')
    return { success: true }
  } catch (err: any) {
    console.error('[updatePaymentSettings] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}