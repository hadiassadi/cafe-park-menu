import 'server-only'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '../supabase/server' // ایمپورت نسبی: توسط vitest هم لود می‌شود
import { getVerifiedPhoneHash } from '../sms/otp' // ایمپورت نسبی: توسط vitest هم لود می‌شود
import { getDeviceHash } from '../orders/owner'

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
  receipt_charge: 'شارژ با تأیید رسید',
  subscription_purchase: 'خرید اشتراک',
  refund: 'بازگشت وجه',
  spend: 'خرج سفارش',
  wallet_activation: 'فعال‌سازی کیف پول',
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
 * مشتریِ کیف‌پول‌دار — دو مسیر:
 * ۱) نشست «تلفن تأییدشده» (کوکی OTP یا لینک دعوت) → customers.phone_hash
 * ۲) دستگاه بدون نشست → آخرین سفارشِ همین دستگاه → مشتریِ «verified»
 *    (تأیید حضوری ادمین بدون OTP هم با این مسیر جواب می‌دهد)
 */
export type ResolvedWalletCustomer = {
  id: string
  phone_hash: string | null
  phone: string | null
  name: string | null
  verification_status: string
  wallet_blocked: boolean
  card_charge_blocked: boolean
}

const CUSTOMER_COLS =
  'id, phone_hash, phone, name, verification_status, wallet_blocked, card_charge_blocked'

async function customerByPhoneHash(phoneHash: string): Promise<ResolvedWalletCustomer | null> {
  const { data, error } = await supabaseAdmin()
    .from('customers')
    .select(CUSTOMER_COLS)
    .eq('phone_hash', phoneHash)
    .maybeSingle()
  if (error) {
    console.error('[wallet] resolve (hash) failed:', error.message)
    return null
  }
  return (data as ResolvedWalletCustomer) ?? null
}

async function customerByDevice(): Promise<ResolvedWalletCustomer | null> {
  const deviceHash = await getDeviceHash()
  if (!deviceHash) return null

  const { data: order, error: orderErr } = await supabaseAdmin()
    .from('orders')
    .select('customer_phone')
    .eq('device_id_hash', deviceHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (orderErr || !order?.customer_phone) return null

  const { data: customer, error: custErr } = await supabaseAdmin()
    .from('customers')
    .select(CUSTOMER_COLS)
    .eq('phone', order.customer_phone)
    .eq('verification_status', 'verified') // فقط مشتری تأییدشده به مسیر دستگاه اعتماد می‌شود
    .maybeSingle()
  if (custErr) {
    console.error('[wallet] resolve (device) failed:', custErr.message)
    return null
  }
  return (customer as ResolvedWalletCustomer) ?? null
}

export async function resolveWalletCustomer(): Promise<ResolvedWalletCustomer | null> {
  const phoneHash = await getVerifiedPhoneHash()
  if (phoneHash) {
    const byHash = await customerByPhoneHash(phoneHash)
    if (byHash) return byHash
  }
  return customerByDevice()
}

/** مشتری بر اساس دستگاه — بدون شرط احراز (برای «درخواست فعال‌سازی» مشتری احرازنشده) */
export async function resolveCustomerByDevice(): Promise<ResolvedWalletCustomer | null> {
  const deviceHash = await getDeviceHash()
  if (!deviceHash) return null

  const { data: order, error: orderErr } = await supabaseAdmin()
    .from('orders')
    .select('customer_phone')
    .eq('device_id_hash', deviceHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (orderErr || !order?.customer_phone) return null

  const { data: customer, error: custErr } = await supabaseAdmin()
    .from('customers')
    .select(CUSTOMER_COLS)
    .eq('phone', order.customer_phone)
    .maybeSingle()
  if (custErr) return null
  return (customer as ResolvedWalletCustomer) ?? null
}

/** سوییچ‌های سراسری کیف پول + آیا پیامک تنظیم شده؟ */
export type WalletFlags = {
  walletEnabled: boolean
  cardChargeEnabled: boolean
  chargeMin: number
  smsConfigured: boolean
}

export async function getWalletFlags(): Promise<WalletFlags> {
  const { data } = await supabaseAdmin()
    .from('settings')
    .select('payment_wallet_enabled, wallet_card_charge_enabled, wallet_charge_min, sms_api_key')
    .eq('id', 1)
    .single()

  return {
    walletEnabled: Boolean(data?.payment_wallet_enabled),
    cardChargeEnabled: Boolean(data?.wallet_card_charge_enabled),
    chargeMin: Number(data?.wallet_charge_min ?? 50000),
    smsConfigured: Boolean(data?.sms_api_key || process.env.KAVENEGAR_API_KEY),
  }
}

/** وضعیت کامل برای پنل مشتری: پرچم‌ها + مشتریِ شناسایی‌شده + موجودی */
export type WalletStatus = WalletFlags & {
  customer: (ResolvedWalletCustomer & { balance: number }) | null
}

export async function getWalletStatus(): Promise<WalletStatus> {
  const flags = await getWalletFlags()
  const customer = await resolveWalletCustomer()

  if (!customer) return { ...flags, customer: null }

  const { data, error } = await supabaseAdmin().rpc('wallet_balance', {
    p_customer_id: customer.id,
  })
  if (error) {
    console.error('[wallet] status balance failed:', error.message)
    return { ...flags, customer: { ...customer, balance: 0 } }
  }
  return { ...flags, customer: { ...customer, balance: Number(data ?? 0) } }
}

/** ثبت یک‌باره‌ی رویداد «فعال‌سازی کیف پول» در دفتر (idempotent) */
export async function ensureActivationTx(customerId: string): Promise<void> {
  const db = supabaseAdmin()
  const { count, error: countErr } = await db
    .from('wallet_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('kind', 'wallet_activation')

  if (countErr || (count ?? 0) > 0) return

  const { error } = await db.from('wallet_transactions').insert({
    customer_id: customerId,
    amount: 0,
    kind: 'wallet_activation',
    status: 'settled',
    note: 'کیف پول فعال شد',
    created_by: 'system',
  })
  if (error) console.error('[wallet] activation tx failed:', error.message)
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
