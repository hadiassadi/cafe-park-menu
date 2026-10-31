import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/club/settings'

export type CreditDecision = {
  allowed: boolean
  reason:
    | 'allowed'
    | 'override_allow'
    | 'override_block'
    | 'unknown_customer'
    | 'not_verified'
    | 'has_debt'
    | 'debt_over_limit'
    | 'not_enough_history'
  settledOrders: number
  openDebt: number
}

const CANCELLED = ['cancelled', 'canceled']

export async function getCustomerCreditState(phone: string): Promise<CreditDecision> {
  const db = supabaseAdmin()
  const settings = await getClubSettings()

  const base = { settledOrders: 0, openDebt: 0 }

  const { data: customer } = await db
    .from('customers')
    .select('id, phone_verified_at, credit_override')
    .eq('phone', phone)
    .maybeSingle()

  if (!customer) return { allowed: false, reason: 'unknown_customer', ...base }

  const { data: orders, error } = await db
    .from('orders')
    .select('id, status, payment_status, subtotal')
    .eq('customer_phone', phone)
    .is('deleted_at', null)
  if (error) {
    console.error('[credit] orders read failed:', error)
    return { allowed: false, reason: 'unknown_customer', ...base }
  }

  const live = (orders ?? []).filter((o: any) => !CANCELLED.includes(o.status))
  const settled = live.filter(
    (o: any) => o.status === 'delivered' && o.payment_status === 'paid'
  ).length

  let openDebt = 0
  const unsettled = live.filter(
    (o: any) => !(o.status === 'delivered' && o.payment_status === 'paid')
  )
  if (unsettled.length > 0) {
    const { data: pays, error: payErr } = await db
      .from('order_payments')
      .select('order_id, amount')
      .in('order_id', unsettled.map((o: any) => o.id))
      .eq('status', 'confirmed')
    if (payErr) {
      console.error('[credit] payments read failed:', payErr)
      return { allowed: false, reason: 'unknown_customer', ...base }
    }
    const paid: Record<string, number> = {}
    for (const p of pays ?? []) paid[p.order_id] = (paid[p.order_id] ?? 0) + Number(p.amount)
    for (const o of unsettled) {
      openDebt += Math.max(0, Number(o.subtotal) - (paid[o.id] ?? 0))
    }
  }

  const state = { settledOrders: settled, openDebt }

  if (customer.credit_override === 'block') {
    return { allowed: false, reason: 'override_block', ...state }
  }
  if (customer.credit_override === 'allow') {
    return { allowed: true, reason: 'override_allow', ...state }
  }
  if (!customer.phone_verified_at) {
    return { allowed: false, reason: 'not_verified', ...state }
  }
  if (settings.block_members_with_debt && openDebt > 0) {
    return { allowed: false, reason: 'has_debt', ...state }
  }
  if (openDebt > settings.max_open_debt) {
    return { allowed: false, reason: 'debt_over_limit', ...state }
  }
  if (settled < settings.min_settled_orders_for_credit && !settings.allow_credit_for_new_members) {
    return { allowed: false, reason: 'not_enough_history', ...state }
  }
  return { allowed: true, reason: 'allowed', ...state }
}
export function creditDenyMessage(reason: CreditDecision['reason']): string {
  switch (reason) {
    case 'has_debt':
    case 'debt_over_limit':
      return 'ابتدا باید بدهی سفارش‌های قبلی شما تسویه شود. لطفاً آنلاین یا کارت به کارت پرداخت کنید.'
    default:
      return 'پرداخت حضوری (نقدی یا کارت‌خوان) برای شما فعال نیست. لطفاً آنلاین یا کارت به کارت پرداخت کنید.'
  }
}
