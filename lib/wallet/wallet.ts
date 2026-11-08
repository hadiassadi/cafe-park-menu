import 'server-only'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '../supabase/server' // ایمپورت نسبی: توسط vitest هم لود می‌شود
import { getVerifiedPhoneHash } from '../sms/otp' // ایمپورت نسبی: توسط vitest هم لود می‌شود

export type WalletTx = {
  id: string
  amount: number
  kind: string
  status: string
  note: string | null
  order_id: string | null
  created_at: string
}

export type WalletView = {
  balance: number
  transactions: WalletTx[]
}

// مبالغ به تومان؛ سقف/کف منطقی برای جلوگیری از ورودی‌های مسخره
export const WALLET_MIN_AMOUNT = 5_000
export const WALLET_MAX_AMOUNT = 10_000_000

export const WALLET_KIND_LABELS: Record<string, string> = {
  admin_charge: 'شارژ توسط ادمین',
  online_charge: 'شارژ آنلاین',
  refund: 'بازگشت وجه',
  spend: 'خرج سفارش',
}

export function isValidWalletAmount(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= WALLET_MIN_AMOUNT &&
    v <= WALLET_MAX_AMOUNT
  )
}

export function walletKindLabel(kind: string): string {
  return WALLET_KIND_LABELS[kind] ?? kind
}

/**
 * مشتریِ کیف‌پول‌دار = کسی که نشست «تلفن تأییدشده» دارد.
 * کوکی فقط هش تلفن است؛ با ستون customers.phone_hash به رکورد مشتری می‌رسیم.
 */
export async function resolveWalletCustomer(): Promise<{ id: string; phone_hash: string } | null> {
  const phoneHash = await getVerifiedPhoneHash()
  if (!phoneHash) return null

  const { data, error } = await supabaseAdmin()
    .from('customers')
    .select('id, phone_hash')
    .eq('phone_hash', phoneHash)
    .maybeSingle()

  if (error) {
    console.error('[wallet] resolve failed:', error.message)
    return null
  }
  return data ?? null
}

export async function getWalletView(customerId: string): Promise<WalletView> {
  const db = supabaseAdmin()

  const { data: balanceData, error: balanceError } = await db.rpc('wallet_balance', {
    p_customer_id: customerId,
  })
  if (balanceError) {
    console.error('[wallet] balance rpc failed:', balanceError.message)
    throw new Error('خطا در خواندن موجودی')
  }

  const { data: tx, error: txError } = await db
    .from('wallet_transactions')
    .select('id, amount, kind, status, note, order_id, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (txError) {
    console.error('[wallet] tx read failed:', txError.message)
    throw new Error('خطا در خواندن تراکنش‌ها')
  }

  return {
    balance: Number(balanceData ?? 0),
    transactions: (tx ?? []) as WalletTx[],
  }
}

/** شارژ توسط ادمین بر اساس شماره تلفن مشتری */
export async function adminChargeByPhone(
  phone: string,
  amount: number,
  note: string | null
): Promise<{ ok?: boolean; error?: string }> {
  const db = supabaseAdmin()
  const { data: customer } = await db
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (!customer?.id) {
    return { error: 'مشتری با این شماره یافت نشد. باید حداقل یک‌بار سفارش داده یا با OTP ورود کند.' }
  }

  const { error } = await db.rpc('wallet_charge', {
    p_customer_id: customer.id,
    p_amount: amount,
    p_kind: 'admin_charge',
    p_note: note,
  })
  if (error) {
    console.error('[wallet] charge rpc failed:', error.message)
    return { error: 'شارژ ناموفق بود' }
  }
  return { ok: true }
}

/** موجودی کیف پول نشست فعلی (اگر با OTP وارد نباشد یا خطا بخورد null) */
export async function getSessionWalletBalance(): Promise<number | null> {
  const customer = await resolveWalletCustomer()
  if (!customer) return null

  const db = supabaseAdmin()
  const { data, error } = await db.rpc('wallet_balance', {
    p_customer_id: customer.id,
  })
  if (error) {
    console.error('[wallet] session balance rpc failed:', error.message)
    return null
  }
  return Number(data ?? 0)
}

/** نمای کیف پول برای ادمین، بر اساس شماره تلفن */
export async function adminWalletByPhone(phone: string): Promise<WalletView | null> {
  const db = supabaseAdmin()
  const { data: customer } = await db
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (!customer?.id) return null
  return getWalletView(customer.id)
}
