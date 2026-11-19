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
// 🎯 پچ ۵۰-و-ب: مالک صندوق (کاربر ادمین) + حساب‌های بانکی با شبا/حساب/کارت + تیک کارتخوان

export type PaymentInstrument = {
  id: string
  name: string
  location: string | null
  label: string | null
  is_active: boolean
  owner_id: string | null
  bank_name: string | null
  iban: string | null
  account_number: string | null
  card_number: string | null
  is_card_reader: boolean
}

export type AdminUserOption = {
  id: string
  name: string
  email: string | null
}

// 🎯 پچ ۵۰-و-ب: فهرست کاربران ادمین — برای انتخاب مالک صندوق
export async function listAdminUsers(): Promise<{
  users?: AdminUserOption[]
  error?: string
}> {
  try {
    await assertAdmin()
    const db = createAdminDb()
    const { data, error } = await db.auth.admin.listUsers({ perPage: 500 })
    if (error) {
      console.error('[listAdminUsers]', error)
      return { error: error.message }
    }
    const users = (data?.users ?? []).map((u) => ({
      id: u.id,
      name:
        (typeof u.user_metadata?.full_name === 'string' &&
          u.user_metadata.full_name.trim()) ||
        u.email ||
        'کاربر',
      email: u.email ?? null,
    }))
    return { users }
  } catch (err: any) {
    console.error('[listAdminUsers] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, 60)
  return s.length > 0 ? s : null
}

function cleanShort(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length > 0 ? s : null
}

// شبا: فقط IR + ۲۴ رقم (فاصله/خط تیره حذف می‌شود)
function cleanIban(v: unknown): { ok: string | null; error?: string } {
  if (v === undefined || v === null || v === '') return { ok: null }
  if (typeof v !== 'string') return { ok: null, error: 'شبا نامعتبر است' }
  const s = v.replace(/[\s-]/g, '').toUpperCase()
  if (!/^IR\d{24}$/.test(s))
    return { ok: null, error: 'شبا باید IR و ۲۴ رقم باشد (مثلاً IR0629...)' }
  return { ok: s }
}

function cleanDigits(
  v: unknown,
  min: number,
  max: number,
  label: string
): { ok: string | null; error?: string } {
  if (v === undefined || v === null || v === '') return { ok: null }
  if (typeof v !== 'string') return { ok: null, error: `${label} نامعتبر است` }
  const s = v.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(s)) return { ok: null, error: `${label} فقط رقم است` }
  if (s.length < min || s.length > max)
    return {
      ok: null,
      error: `${label} باید بین ${min} تا ${max} رقم باشد`,
    }
  return { ok: s }
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
        .select(
          'id, name, location, is_active, owner_id'
        )
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true }),
      db
        .from('pos_devices')
        .select(
          'id, name, label, is_active, bank_name, iban, account_number, card_number, is_card_reader'
        )
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
    const fill = (r: Record<string, unknown>) => ({
      owner_id: (r.owner_id as string | null) ?? null,
      bank_name: (r.bank_name as string | null) ?? null,
      iban: (r.iban as string | null) ?? null,
      account_number: (r.account_number as string | null) ?? null,
      card_number: (r.card_number as string | null) ?? null,
      is_card_reader: (r.is_card_reader as boolean | null) ?? false,
    })
    return {
      registers: ((regs.data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as PaymentInstrument),
        ...fill(r),
        is_card_reader: false,
      })),
      devices: ((devs.data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as PaymentInstrument),
        ...fill(r),
        owner_id: null,
      })),
    }
  } catch (err: any) {
    console.error('[listPaymentInstruments] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function createCashRegister(
  name: string,
  location: string | null,
  ownerId: string | null
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
      // 🎯 ۵۰-و-ب: مالک صندوق — پیش‌فرضِ تسویهٔ همان اپراتور (خالی = مشترک)
      owner_id: ownerId || null,
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
  changes: {
    name?: string
    location?: string | null
    is_active?: boolean
    owner_id?: string | null
  }
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
    // مالک: string معتبر یا null (برداشتن مالک) — رشتهٔ خالی هم یعنی بدون مالک
    if (changes.owner_id !== undefined) {
      upd.owner_id = changes.owner_id || null
    }
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

export type BankAccountInput = {
  name: string
  label?: string | null
  bank_name?: string | null
  iban?: string | null
  account_number?: string | null
  card_number?: string | null
  is_card_reader?: boolean
}

function bankFields(input: BankAccountInput, partial: boolean): {
  upd: Record<string, unknown>
  error?: string
} {
  const upd: Record<string, unknown> = {}
  if (!partial || input.name !== undefined) {
    const n = cleanName(input.name)
    if (!n) return { upd, error: 'نام حساب را وارد کنید' }
    upd.name = n
  }
  if (input.label !== undefined) upd.label = cleanShort(input.label, 80)
  if (input.bank_name !== undefined)
    upd.bank_name = cleanShort(input.bank_name, 60)
  if (input.iban !== undefined) {
    const r = cleanIban(input.iban)
    if (r.error) return { upd, error: r.error }
    upd.iban = r.ok
  }
  if (input.account_number !== undefined) {
    const r = cleanDigits(input.account_number, 6, 30, 'شماره حساب')
    if (r.error) return { upd, error: r.error }
    upd.account_number = r.ok
  }
  if (input.card_number !== undefined) {
    const r = cleanDigits(input.card_number, 12, 24, 'شماره کارت')
    if (r.error) return { upd, error: r.error }
    upd.card_number = r.ok
  }
  if (typeof input.is_card_reader === 'boolean')
    upd.is_card_reader = input.is_card_reader
  return { upd }
}

export async function createPosDevice(
  input: BankAccountInput
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()
    const { upd, error } = bankFields(input, false)
    if (error) return { error }
    if (!('is_card_reader' in upd)) upd.is_card_reader = true
    const db = createAdminDb()
    const { error: dbErr } = await db.from('pos_devices').insert(upd)
    if (dbErr) {
      console.error('[createPosDevice]', dbErr)
      return { error: dbErr.message }
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
  changes: Partial<BankAccountInput> & { is_active?: boolean }
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdmin()
    const { upd, error } = bankFields(changes as BankAccountInput, true)
    if (error) return { error }
    if (typeof changes.is_active === 'boolean') upd.is_active = changes.is_active
    if (Object.keys(upd).length === 0) return { error: 'تغییری ارسال نشده است' }
    const db = createAdminDb()
    const { error: dbErr } = await db.from('pos_devices').update(upd).eq('id', id)
    if (dbErr) {
      console.error('[updatePosDevice]', dbErr)
      return { error: dbErr.message }
    }
    revalidatePath('/admin/settings/payment')
    return { success: true }
  } catch (err: any) {
    console.error('[updatePosDevice] unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
