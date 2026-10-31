'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { assertAdmin, assertAdminId } from '@/lib/admin/assert-admin'


function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type ClubSettingsForm = {
  min_settled_orders_for_credit: number
  allow_credit_for_new_members: boolean
  block_members_with_debt: boolean
  max_open_debt: number
  min_partial_payment: number
}

const FIELDS =
  'min_settled_orders_for_credit, allow_credit_for_new_members, block_members_with_debt, max_open_debt, min_partial_payment'

export async function getClubSettings(): Promise<{
  data?: ClubSettingsForm
  error?: string
}> {
  try {
    await assertAdmin()
    const db = createAdminDb()
    const { data, error } = await db
      .from('club_settings')
      .select(FIELDS)
      .eq('id', true)
      .single()

    if (error) {
      console.error('[getClubSettings]', error)
      return { error: 'خطا در خواندن تنظیمات' }
    }
    return { data: data as unknown as ClubSettingsForm }
  } catch (err) {
    console.error('[getClubSettings] unexpected:', err)
    return { error: 'خطای غیرمنتظره' }
  }
}

function toInt(v: unknown, min: number, max: number): number | null {
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < min || n > max) return null
  return n
}

export async function updateClubSettings(
  input: ClubSettingsForm
): Promise<{ success?: boolean; error?: string }> {
  try {
    const changedBy = await assertAdminId()
    if (!input || typeof input !== 'object') {
      return { error: 'داده‌ی نامعتبر' }
    }

    const minOrders = toInt(input.min_settled_orders_for_credit, 0, 100)
    const maxDebt = toInt(input.max_open_debt, 0, 1_000_000_000)
    const minPartial = toInt(input.min_partial_payment, 0, 1_000_000_000)

    if (minOrders === null) return { error: 'حداقل سفارش تسویه‌شده باید عدد بین ۰ تا ۱۰۰ باشد' }
    if (maxDebt === null) return { error: 'سقف بدهی نامعتبر است' }
    if (minPartial === null) return { error: 'حداقل پرداخت جزئی نامعتبر است' }

    const next = {
      min_settled_orders_for_credit: minOrders,
      allow_credit_for_new_members: input.allow_credit_for_new_members === true,
      block_members_with_debt: input.block_members_with_debt === true,
      max_open_debt: maxDebt,
      min_partial_payment: minPartial,
    }

    const db = createAdminDb()

    const { data: old } = await db
      .from('club_settings')
      .select(FIELDS)
      .eq('id', true)
      .single()
    const { error } = await db
      .from('club_settings')
      .update({
        ...next,
        updated_at: new Date().toISOString(),
        updated_by: changedBy,
      })
      .eq('id', true)

    if (error) {
      console.error('[updateClubSettings]', error)
      return { error: 'خطا در ذخیرهٔ تنظیمات' }
    }

    const { error: logError } = await db.from('club_settings_log').insert({
      changed_by: changedBy,
      old_values: old ?? null,
      new_values: next,
    })
    if (logError) console.error('[updateClubSettings] log failed:', logError)

    revalidatePath('/admin/settings/club')
    return { success: true }
  } catch (err) {
    console.error('[updateClubSettings] unexpected:', err)
    return { error: 'خطای غیرمنتظره' }
  }
}
