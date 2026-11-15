import 'server-only'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashData } from '../utils/hash'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getDeviceHash(): Promise<string | null> {
  const store = await cookies()
  const token = store.get('cafe_device_token')?.value
  return token ? hashData(token) : null
}

// 🎯 پچ ۵۰-هـ-ز: هر دو نسخهٔ هش دستگاه (قدیمی sha256 برای سفارش‌های قدیمی + جدید
// با Salt) — مبنای همهٔ چک‌های مالکیت دستگاه
export async function getDeviceHashes(): Promise<string[]> {
  const store = await cookies()
  const token = store.get('cafe_device_token')?.value
  if (!token) return []
  const oldHash = crypto.createHash('sha256').update(token).digest('hex')
  const newHash = hashData(token)
  return oldHash === newHash ? [oldHash] : [oldHash, newHash]
}

// 🎯 پچ ۵۰-هـ-ز: زنجیرهٔ شناسایی شمارهٔ مشتریِ دستگاه — همان منطق پنل مشتری:
// ۱) آخرین سفارشِ دستگاه  ۲) ردیف customers وصل‌شده به دستگاه  ۳) عضو سازمانیِ دستگاه
export async function getDeviceCustomerPhone(
  db: SupabaseClient,
  hashes: string[]
): Promise<string> {
  if (hashes.length === 0) return ''

  const { data: anchor } = await db
    .from('orders')
    .select('customer_phone')
    .in('device_id_hash', hashes)
    .not('customer_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const fromOrder = String((anchor as any)?.customer_phone ?? '').trim()
  if (fromOrder) return fromOrder

  const { data: custRow } = await db
    .from('customers')
    .select('phone')
    .in('device_id_hash', hashes)
    .not('phone', 'is', null)
    .limit(1)
    .maybeSingle()
  const fromCust = String((custRow as any)?.phone ?? '').trim()
  if (fromCust) return fromCust

  const { data: orgRow } = await db
    .from('organization_members')
    .select('metadata')
    .in('device_id_hash', hashes)
    .eq('is_registered', true)
    .limit(1)
    .maybeSingle()
  return String((orgRow as any)?.metadata?._phone ?? '').trim()
}

// 🎯 پچ ۵۰-هـ-ز: سفارش در دسترس این دستگاه/مشتری است؟
// سفارش‌های آنلاین با هش دستگاه؛ سفارش‌های حضوری (POS) با شمارهٔ مشتری وصل می‌شوند
export function deviceOwnsOrderRow(
  order: { device_id_hash?: string | null; customer_phone?: string | null },
  hashes: string[],
  phone: string
): boolean {
  const byDevice = !!order.device_id_hash && hashes.includes(order.device_id_hash)
  const byPhone = !!phone && order.customer_phone === phone
  return byDevice || byPhone
}

// 🎯 پچ ۵۰-هـ-ز: آیا هشِ سفارش جزو هش‌های معتبر این دستگاه است؟
export function hashesInclude(
  deviceHash: string | null | undefined,
  hashes: string[]
): boolean {
  return !!deviceHash && hashes.includes(deviceHash)
}
