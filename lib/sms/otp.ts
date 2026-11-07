import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashData } from '../utils/hash' // ایمپورت نسبی: این ماژول توسط vitest هم لود می‌شود و الیاس @ ندارد

export const OTP_TTL_MIN = 5
export const OTP_MAX_ATTEMPTS = 5
export const PHONE_COOKIE = 'cafe_phone_verified'
export const PHONE_COOKIE_DAYS = 90

// ─── توابع خالص (قابل تست) ─────────────────────────────────────────────

// هم‌سو با app/api/membership/register/route.ts: ارقام فارسی/عربی و فرمت 09xxxxxxxxx
export function normalizePhone(v: unknown): string {
  let p = String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^98/, '0')
  if (/^9\d{9}$/.test(p)) p = '0' + p
  return p
}

export function isValidIranMobile(p: string): boolean {
  return /^09\d{9}$/.test(p)
}

export function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000))
}

export function phoneHash(phone: string): string {
  return hashData(phone)
}

export type OtpRow = {
  id: string
  code_hash: string
  attempts: number
  used: boolean
  expires_at: string
}

export type OtpCheck =
  | { ok: true }
  | {
      ok: false
      reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch'
      attemptsLeft?: number
      retryAfterSec?: number
    }

/** تصمیم‌گیری برای یک کد واردشده — بدون دیتابیس، کاملاً تست‌پذیر */
export function checkOtpRow(row: OtpRow | null, code: string, nowMs = Date.now()): OtpCheck {
  if (!row || row.used) return { ok: false, reason: 'not_found' }

  const expiresMs = new Date(row.expires_at).getTime()
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
    return { ok: false, reason: 'expired' }
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' }
  }

  const a = Buffer.from(hashData(code), 'hex')
  const b = Buffer.from(row.code_hash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      ok: false,
      reason: 'mismatch',
      attemptsLeft: OTP_MAX_ATTEMPTS - row.attempts - 1,
    }
  }

  return { ok: true }
}

/** پیام فارسی برای هر علت رد شدن — به کلاینت فقط همین می‌رود */
export function otpRejectMessage(reason: NonNullable<Extract<OtpCheck, { ok: false }>['reason']>): string {
  switch (reason) {
    case 'not_found':
      return 'کدی برای این شماره فعال نیست. دوباره درخواست بدهید.'
    case 'expired':
      return 'کد منقضی شده است. دوباره درخواست بدهید.'
    case 'too_many_attempts':
      return 'تعداد تلاش‌های نامعتبر زیاد است. کد جدید بگیرید.'
    case 'mismatch':
      return 'کد وارد شده درست نیست.'
  }
}

// ─── عملیات دیتابیس (service-role) ──────────────────────────────────────

export async function storeOtp(
  db: SupabaseClient,
  pHash: string,
  codeHash: string
): Promise<void> {
  // کدهای قبلیِ مصرف‌نشده بی‌اعتبار می‌شوند؛ فقط آخرین کد معتبر است
  await db.from('otp_codes').update({ used: true }).eq('phone_hash', pHash).eq('used', false)
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString()
  await db.from('otp_codes').insert({ phone_hash: pHash, code_hash: codeHash, expires_at: expiresAt })
}

export async function getLatestOtp(
  db: SupabaseClient,
  pHash: string
): Promise<OtpRow | null> {
  const { data } = await db
    .from('otp_codes')
    .select('id, code_hash, attempts, used, expires_at')
    .eq('phone_hash', pHash)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as OtpRow | null) ?? null
}

/** مصرف اتمیک کد: اگر هم‌زمان دو درخواست برسند فقط یکی موفق می‌شود */
export async function claimOtp(db: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await db
    .from('otp_codes')
    .update({ used: true })
    .eq('id', id)
    .eq('used', false)
    .select('id')
  return !!data && data.length > 0
}

export async function bumpOtpAttempts(db: SupabaseClient, row: OtpRow): Promise<void> {
  await db.from('otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id)
}

/** پاکسازی کدهای مصرف‌شده/منقضیِ این شماره بعد از تأیید موفق */
export async function cleanupPhoneOtps(db: SupabaseClient, pHash: string): Promise<void> {
  await db.from('otp_codes').delete().eq('phone_hash', pHash).eq('used', true)
}

/** بعد از تأیید OTP، مشتری در باشگاه ثبت/به‌روز می‌شود و هش دستگاه فعلی به او می‌چسبد */
export async function upsertVerifiedCustomer(
  db: SupabaseClient,
  phone: string,
  deviceIdHash: string | null
): Promise<void> {
  const { data: existing } = await db
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (existing?.id) {
    if (deviceIdHash) {
      await db.from('customers').update({ device_id_hash: deviceIdHash }).eq('id', existing.id)
    }
    return
  }

  await db.from('customers').insert({
    phone,
    ...(deviceIdHash ? { device_id_hash: deviceIdHash } : {}),
  })
}

// ─── نشست «شماره تأییدشده» ─────────────────────────────────────────────
// مقدار کوکی، هش HMAC شماره است؛ بدون HASH_SALT قابل جعل نیست.
// بررسی وجود مشتری در دیتابیس، در زمان استفاده (کیف پول/سفارش) انجام می‌شود.

export async function setPhoneSession(phone: string): Promise<void> {
  const store = await cookies()
  store.set(PHONE_COOKIE, phoneHash(phone), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: PHONE_COOKIE_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

export async function getVerifiedPhoneHash(): Promise<string | null> {
  const store = await cookies()
  const v = store.get(PHONE_COOKIE)?.value
  return v && v.length === 64 ? v : null
}

export async function clearPhoneSession(): Promise<void> {
  const store = await cookies()
  store.delete(PHONE_COOKIE)
}

/** برای لاگ: هرگز شماره‌ی خام را لاگ نکنیم */
export function maskPhone(phone: string): string {
  const h = createHash('sha256').update(phone).digest('hex').slice(0, 6)
  return `${phone.slice(0, 4)}****${phone.slice(-2)}#${h}`
}
