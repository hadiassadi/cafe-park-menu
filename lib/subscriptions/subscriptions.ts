import 'server-only'
import { supabaseAdmin } from '../supabase/server' // ایمپورت نسبی: توسط vitest هم لود می‌شود

// ============================================================
// اشتراک ماهیانه — خواندن پلن‌ها و اشتراک فعال مشتری (سمت سرور)
// ============================================================

export type SubscriptionFlags = {
  subscriptionEnabled: boolean
}

export async function getSubscriptionFlags(): Promise<SubscriptionFlags> {
  const { data } = await supabaseAdmin()
    .from('settings')
    .select('subscription_enabled')
    .eq('id', 1)
    .single()

  return { subscriptionEnabled: Boolean(data?.subscription_enabled) }
}

export type ActiveSubscription = {
  id: string
  planName: string
  discountPercent: number
  endsAt: string
  source: string
}

function toActiveSubscription(row: any): ActiveSubscription {
  return {
    id: String(row.id),
    planName: String(row.plan_name ?? ''),
    discountPercent: Number(row.discount_percent ?? 0),
    endsAt: String(row.ends_at ?? ''),
    source: String(row.source ?? 'wallet'),
  }
}

/** اشتراکِ فعال مشتری بر اساس شناسه — ردیفِ گذشته‌ی تاریخ «منقضی» شمرده می‌شود */
export async function getActiveSubscriptionForCustomer(
  customerId: string
): Promise<ActiveSubscription | null> {
  if (!customerId) return null

  const { data, error } = await supabaseAdmin()
    .from('customer_subscriptions')
    .select('id, plan_name, discount_percent, ends_at, source')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .gt('ends_at', new Date().toISOString())
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[subscriptions] active (by id) failed:', error.message)
    return null
  }
  return data ? toActiveSubscription(data) : null
}

/** اشتراکِ فعال مشتری بر اساس شماره — برای اعمال تخفیف در ثبت سفارش */
export async function getActiveSubscriptionByPhone(
  phone: string | null | undefined
): Promise<ActiveSubscription | null> {
  if (!phone) return null

  const { data, error } = await supabaseAdmin()
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .eq('verification_status', 'verified')
    .maybeSingle()

  if (error || !data?.id) return null
  return getActiveSubscriptionForCustomer(String(data.id))
}
