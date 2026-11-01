import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type TakeawayFee = { id: string; name: string; fee: number }

/** گروه‌های هزینهٔ فعالِ مربوط به محصولات (از خود محصول یا دسته‌اش) */
export async function loadActiveFees(
  db: SupabaseClient,
  products: any[]
): Promise<Map<string, TakeawayFee>> {
  const ids = new Set<string>()
  for (const p of products) {
    if (p.takeaway_fee_id) ids.add(p.takeaway_fee_id)
    if (p.categories?.takeaway_fee_id) ids.add(p.categories.takeaway_fee_id)
  }
  const map = new Map<string, TakeawayFee>()
  if (ids.size === 0) return map

  const { data, error } = await db
    .from('takeaway_fees')
    .select('id, name, fee')
    .in('id', [...ids])
    .eq('is_active', true)
  if (error) throw error

  for (const f of data ?? []) {
    map.set(f.id, { id: f.id, name: f.name, fee: Number(f.fee) })
  }
  return map
}

/** اولویت: گروه خود محصول، بعد گروه دسته. اگر نبود یا غیرفعال بود، null */
export function feeForProduct(
  p: any,
  fees: Map<string, TakeawayFee>
): TakeawayFee | null {
  const id = p.takeaway_fee_id ?? p.categories?.takeaway_fee_id ?? null
  return id ? (fees.get(id) ?? null) : null
}

/** میز فعال با این شماره، یا null */
export async function findActiveTable(
  db: SupabaseClient,
  tableNo: number
): Promise<{ id: string; number: number } | null> {
  const { data, error } = await db
    .from('tables')
    .select('id, number')
    .eq('number', tableNo)
    .eq('is_active', true)
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}
