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
  payment_wallet_enabled: boolean
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
  'payment_enabled, payment_online_enabled, payment_cash_enabled, payment_card_enabled, payment_transfer_enabled, payment_wallet_enabled, payment_gateway, payment_merchant_id, payment_sandbox_mode, payment_min_online_amount, payment_transfer_bank_name, payment_transfer_account_number, payment_transfer_card_number, payment_transfer_account_holder, payment_transfer_requires_review, payment_transfer_auto_verify'

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
      !settings.payment_transfer_enabled &&
      !settings.payment_wallet_enabled
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

// ─── 🎯 پچ ۵۰-و-الف: صندوق‌های نقدی + کارتخوان‌ها (زیرساخت پرداخت POS) ───

export type PaymentInstrument = {
  id: string
  name: string
  location: string | null
  label: string | null
  is_active: boolean
}

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, 60)
  return s.length > 0 ? s : null
}

export async function listPaymentInstruments(): Promise<{
  registers?: PaymentInstrument[]
  devices?: PaymentInstrument[]
  error?: string
}> {
  try {
    await assertAdmin()
    const db = createAdminDb()
    const [regs, devs] = await Promise.all([
      db
        .from('cash_registers')
        .select('id, name, location, is_active')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true }),
      db
        .from('pos_devices')
        .select('id, name, label, is_active')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true }),
    ])
    if (regs.error) {
      console.error('[listPaymentInstruments] registers:', regs.error)
      return { error: regs.error.message }
    }
    if (devs.error) {
      console.error('[listPaymentInstruments] devices:', devs.error)
      return { error: devs.error.message }
    }
    return {
      registers: (regs.data ?? []) as unknown as PaymentInstrument[],
      devices: (devs.data ?? []) as unknown as PaymentInstrument[],
    }
  } catch (err: any) {
    console.error('[listPaymentInstruments] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function createCashRegister(
  name: string,
  location: string | null
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()
    const clean = cleanName(name)
    if (!clean) return { error: 'نام صندوق را وارد کنید' }
    const db = createAdminDb()
    const { error } = await db.from('cash_registers').insert({
      name: clean,
      location:
        typeof location === 'string' && location.trim()
          ? location.trim().slice(0, 80)
          : null,
    })
    if (error) {
      console.error('[createCashRegister]', error)
      return { error: error.message }
    }
    revalidatePath('/admin/settings/payment')
    return { success: true }
  } catch (err: any) {
    console.error('[createCashRegister] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function updateCashRegister(
  id: string,
  changes: { name?: string; location?: string | null; is_active?: boolean }
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()
    const upd: Record<string, unknown> = {}
    const n = changes.name === undefined ? null : cleanName(changes.name)
    if (n === null && changes.name !== undefined) {
      return { error: 'نام صندوق را وارد کنید' }
    }
    if (n) upd.name = n
    if (changes.location !== undefined) {
      upd.location =
        typeof changes.location === 'string' && changes.location.trim()
          ? changes.location.trim().slice(0, 80)
          : null
    }
    if (typeof changes.is_active === 'boolean') upd.is_active = changes.is_active
    if (Object.keys(upd).length === 0) return { error: 'تغییری ارسال نشده است' }
    const db = createAdminDb()
    const { error } = await db.from('cash_registers').update(upd).eq('id', id)
    if (error) {
      console.error('[updateCashRegister]', error)
      return { error: error.message }
    }
    revalidatePath('/admin/settings/payment')
    return { success: true }
  } catch (err: any) {
    console.error('[updateCashRegister] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function createPosDevice(
  name: string,
  label: string | null
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()
    const clean = cleanName(name)
    if (!clean) return { error: 'نام دستگاه را وارد کنید' }
    const db = createAdminDb()
    const { error } = await db.from('pos_devices').insert({
      name: clean,
      label:
        typeof label === 'string' && label.trim()
          ? label.trim().slice(0, 80)
          : null,
    })
    if (error) {
      console.error('[createPosDevice]', error)
      return { error: error.message }
    }
    revalidatePath('/admin/settings/payment')
    return { success: true }
  } catch (err: any) {
    console.error('[createPosDevice] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function updatePosDevice(
  id: string,
  changes: { name?: string; label?: string | null; is_active?: boolean }
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()
    const upd: Record<string, unknown> = {}
    const n = changes.name === undefined ? null : cleanName(changes.name)
    if (n === null && changes.name !== undefined) {
      return { error: 'نام دستگاه را وارد کنید' }
    }
    if (n) upd.name = n
    if (changes.label !== undefined) {
      upd.label =
        typeof changes.label === 'string' && changes.label.trim()
          ? changes.label.trim().slice(0, 80)
          : null
    }
    if (typeof changes.is_active === 'boolean') upd.is_active = changes.is_active
    if (Object.keys(upd).length === 0) return { error: 'تغییری ارسال نشده است' }
    const db = createAdminDb()
    const { error } = await db.from('pos_devices').update(upd).eq('id', id)
    if (error) {
      console.error('[updatePosDevice]', error)
      return { error: error.message }
    }
    revalidatePath('/admin/settings/payment')
    return { success: true }
  } catch (err: any) {
    console.error('[updatePosDevice] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
