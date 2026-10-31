import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'

export type ClubSettings = {
  min_settled_orders_for_credit: number
  allow_credit_for_new_members: boolean
  block_members_with_debt: boolean
  max_open_debt: number
  min_partial_payment: number
}

// اگر ردیف تنظیمات خوانده نشد، از این مقادیر محتاطانه استفاده می‌شود.
export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  min_settled_orders_for_credit: 2,
  allow_credit_for_new_members: false,
  block_members_with_debt: true,
  max_open_debt: 500000,
  min_partial_payment: 10000,
}

export async function getClubSettings(): Promise<ClubSettings> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('club_settings')
    .select(
      'min_settled_orders_for_credit, allow_credit_for_new_members, block_members_with_debt, max_open_debt, min_partial_payment'
    )
    .eq('id', true)
    .maybeSingle()

  if (error || !data) {
    console.error('[club settings] read failed, using defaults:', error)
    return DEFAULT_CLUB_SETTINGS
  }

  return {
    min_settled_orders_for_credit: Number(data.min_settled_orders_for_credit),
    allow_credit_for_new_members: !!data.allow_credit_for_new_members,
    block_members_with_debt: !!data.block_members_with_debt,
    max_open_debt: Number(data.max_open_debt),
    min_partial_payment: Number(data.min_partial_payment),
  }
}
