import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const CUSTOMER_COOKIE = 'cafe_customer_session'
export const SESSION_DAYS = 30

function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are missing')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export type CustomerSession = {
  phone: string
  verified_at: string
}

/**
 * خواندن session فعلی از cookie و برگرداندن اطلاعات مشتری
 */
export async function getCurrentCustomer(): Promise<CustomerSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(CUSTOMER_COOKIE)?.value
    if (!token) return null

    const db = createDb()
    const { data, error } = await db
      .from('customer_sessions')
      .select('phone, verified_at')
      .eq('session_token', token)
      .not('verified_at', 'is', null)
      .maybeSingle()

    if (error || !data) return null

    // بررسی انقضا (۳۰ روز)
    const verifiedAt = new Date(data.verified_at)
    const daysSince = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > SESSION_DAYS) return null

    return { phone: data.phone, verified_at: data.verified_at }
  } catch {
    return null
  }
}

/**
 * پاک کردن session فعلی
 */
export async function clearCustomerSession(): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(CUSTOMER_COOKIE)?.value
    if (!token) return

    const db = createDb()
    await db
      .from('customer_sessions')
      .delete()
      .eq('session_token', token)

    cookieStore.delete(CUSTOMER_COOKIE)
  } catch {
    // silent
  }
}

/**
 * اعتبارسنجی شماره موبایل ایرانی
 */
export function isValidIranianMobile(phone: string): boolean {
  const cleaned = phone.replace(/[^\d]/g, '')
  return /^09\d{9}$/.test(cleaned)
}

/**
 * نرمال‌سازی شماره (پاک کردن فاصله، خط تیره، +98 → 0)
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, '')
  if (cleaned.startsWith('98') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2)
  }
  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned
  }
  return cleaned
}

/**
 * تولید کد ۴ رقمی
 */
export function generateOtpCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * تولید session token امن
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}