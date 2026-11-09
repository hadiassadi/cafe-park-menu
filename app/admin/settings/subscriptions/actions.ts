'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { assertAdmin, assertAdminId } from '@/lib/admin/assert-admin'
import { planInputError, type PlanInput } from '@/lib/subscriptions/plans'

function createAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type AdminPlan = {
  id: string
  name: string
  price: number
  duration_days: number
  discount_percent: number
  benefits: string | null
  sort_order: number
  is_active: boolean
}

export type AdminSubscriptionRow = {
  id: string
  customer_phone: string | null
  customer_name: string | null
  plan_name: string
  discount_percent: number
  price_paid: number
  ends_at: string
  source: string
  status: string
}

export type SubscriptionFlagsForm = {
  subscription_enabled: boolean
}

function toNum(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function listPlans(): Promise<{
  plans?: AdminPlan[]
  flags?: SubscriptionFlagsForm
  subscriptions?: AdminSubscriptionRow[]
  error?: string
}> {
  try {
    await assertAdmin()
    const db = createAdminDb()

    const [{ data: plans, error: pErr }, { data: settings, error: sErr }, { data: subs, error: subErr }] =
      await Promise.all([
        db
          .from('subscription_plans')
          .select('id, name, price, duration_days, discount_percent, benefits, sort_order, is_active')
          .order('sort_order', { ascending: true })
          .order('price', { ascending: true }),
        db
          .from('settings')
          .select('subscription_enabled')
          .eq('id', 1)
          .maybeSingle(),
        db
          .from('customer_subscriptions')
          .select('id, plan_name, discount_percent, price_paid, ends_at, source, status, customers(phone, name)')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

    if (pErr) {
      console.error('[subscriptions] plans list:', pErr)
      return { error: 'خطا در خواندن پلن‌ها' }
    }
    if (sErr) {
      console.error('[subscriptions] settings:', sErr)
      return { error: 'خطا در خواندن تنظیمات اشتراک' }
    }
    if (subErr) {
      console.error('[subscriptions] list subs:', subErr)
      return { error: 'خطا در خواندن اشتراک‌ها' }
    }

    return {
      plans: (plans ?? []).map((p: any) => ({
        id: String(p.id),
        name: String(p.name ?? ''),
        price: Number(p.price ?? 0),
        duration_days: Number(p.duration_days ?? 30),
        discount_percent: Number(p.discount_percent ?? 0),
        benefits: (p.benefits as string) ?? null,
        sort_order: Number(p.sort_order ?? 10),
        is_active: p.is_active !== false,
      })),
      flags: { subscription_enabled: settings?.subscription_enabled === true },
      subscriptions: (subs ?? []).map((s: any) => ({
        id: String(s.id),
        customer_phone: (s.customers?.phone as string) ?? null,
        customer_name: (s.customers?.name as string) ?? null,
        plan_name: String(s.plan_name ?? ''),
        discount_percent: Number(s.discount_percent ?? 0),
        price_paid: Number(s.price_paid ?? 0),
        ends_at: String(s.ends_at ?? ''),
        source: String(s.source ?? 'wallet'),
        status: String(s.status ?? 'active'),
      })),
    }
  } catch (err: any) {
    console.error('[subscriptions] list unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function savePlan(input: PlanInput): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdminId()
    const vErr = planInputError(input)
    if (vErr) return { error: vErr }

    const db = createAdminDb()
    const row = {
      name: String(input.name).trim(),
      price: Math.round(input.price),
      duration_days: input.duration_days,
      discount_percent: input.discount_percent,
      benefits: String(input.benefits ?? '').trim() || null,
      sort_order: input.sort_order,
      is_active: input.is_active === true,
    }

    if (input.id) {
      const { error } = await db.from('subscription_plans').update(row).eq('id', String(input.id))
      if (error) {
        console.error('[subscriptions] update:', error)
        return { error: 'خطا در ذخیره‌ی پلن' }
      }
    } else {
      const { error } = await db.from('subscription_plans').insert(row)
      if (error) {
        console.error('[subscriptions] insert:', error)
        return { error: 'خطا در ساخت پلن' }
      }
    }

    revalidatePath('/admin/settings/subscriptions')
    return { success: true }
  } catch (err: any) {
    console.error('[subscriptions] save unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function deletePlan(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdminId()
    if (!id) return { error: 'شناسه پلن نامعتبر است' }

    const db = createAdminDb()

    // اگر اشتراکی روی این پلن خریداری شده، حذف نکن — غیرفعال کن
    const { count, error: countErr } = await db
      .from('customer_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id)

    if (countErr) {
      console.error('[subscriptions] delete count:', countErr)
      return { error: 'خطا در بررسی استفاده‌کنندگان پلن' }
    }
    if ((count ?? 0) > 0) {
      return {
        error: `${(count ?? 0).toLocaleString('fa-IR')} اشتراک روی این پلن خریداری شده؛ به‌جای حذف، پلن را «غیرفعال» کن.`,
      }
    }

    // اگر درخواستِ در انتظاری روی این پلن است، حذف مسدود شود تا رسید ادمین معلق نماند
    const { count: pendingCount, error: pendErr } = await db
      .from('wallet_charge_requests')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id)
      .eq('status', 'pending')
    if (pendErr) {
      console.error('[subscriptions] delete pending count:', pendErr)
      return { error: 'خطا در بررسی درخواست‌های در انتظار' }
    }
    if ((pendingCount ?? 0) > 0) {
      return {
        error: `${(pendingCount ?? 0).toLocaleString('fa-IR')} درخواستِ در انتظارِ تأیید روی این پلن است؛ اول در صف «کیف پول مشتریان» نتیجه را مشخص کن.`,
      }
    }

    const { error } = await db.from('subscription_plans').delete().eq('id', id)
    if (error) {
      console.error('[subscriptions] delete:', error)
      return { error: 'خطا در حذف پلن' }
    }

    revalidatePath('/admin/settings/subscriptions')
    return { success: true }
  } catch (err: any) {
    console.error('[subscriptions] delete unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}

export async function saveSubscriptionFlags(
  input: SubscriptionFlagsForm
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertAdminId()

    const db = createAdminDb()
    const { error } = await db
      .from('settings')
      .update({ subscription_enabled: input?.subscription_enabled === true })
      .eq('id', 1)

    if (error) {
      console.error('[subscriptions] flags save:', error)
      return { error: 'خطا در ذخیره‌ی تنظیمات اشتراک' }
    }

    revalidatePath('/admin/settings/subscriptions')
    return { success: true }
  } catch (err: any) {
    console.error('[subscriptions] flags unexpected:', err)
    return { error: err?.message || 'خطای غیرمنتظره' }
  }
}
