'use server'
import { assertAdmin } from '@/lib/admin/assert-admin'

import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server'

type Input = {
  orders: boolean
  customers: boolean
  coupons: boolean
  receipts: boolean
  confirm: string
}

type Output =
  | { ok: true; result: unknown; receiptsRemoved: number }
  | { ok: false; error: string }

const BUCKET = 'receipts'

// همه‌ی فایل‌های باکت را (حتی داخل پوشه‌ها) پیدا می‌کند
async function listAllFiles(
  admin: ReturnType<typeof supabaseAdmin>,
  prefix = ''
): Promise<string[]> {
  const files: string[] = []
  let offset = 0

  while (true) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset })

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        // پوشه است
        files.push(...(await listAllFiles(admin, path)))
      } else {
        files.push(path)
      }
    }

    if (data.length < 100) break
    offset += 100
  }

  return files
}

export async function resetData(input: Input): Promise<Output> {
  await assertAdmin()
  // ۱) قفل محیطی
  if (process.env.ALLOW_DATA_RESET !== 'true') {
    return { ok: false, error: 'ریست داده‌ها در این محیط غیرفعال است.' }
  }

  // ۲) تایید تایپی
  if (input.confirm !== 'RESET') {
    return { ok: false, error: 'عبارت تایید درست نیست.' }
  }

  if (!input.orders && !input.customers && !input.coupons && !input.receipts) {
    return { ok: false, error: 'هیچ موردی انتخاب نشده است.' }
  }

  try {
    // ۳) کاربر واردشده (نقش authenticated، تابع SQL خودش is_admin را چک می‌کند)
    const supabase = await supabaseServer()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return { ok: false, error: 'ابتدا وارد پنل شوید.' }
    }

    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    if (
      adminEmails.length > 0 &&
      !adminEmails.includes((userData.user.email ?? '').toLowerCase())
    ) {
      return { ok: false, error: 'دسترسی مجاز نیست.' }
    }

    // ۴) پاک‌سازی جدول‌ها
    let result: unknown = null
    if (input.orders || input.customers || input.coupons) {
      const { data, error } = await supabase.rpc('reset_test_data', {
        p_orders: input.orders,
        p_customers: input.customers,
        p_coupons: input.coupons,
      })
      if (error) return { ok: false, error: error.message }
      result = data
    }

    // ۵) پاک‌سازی فایل‌های رسید
    let receiptsRemoved = 0
    if (input.receipts) {
      const admin = supabaseAdmin()
      const files = await listAllFiles(admin)

      for (let i = 0; i < files.length; i += 100) {
        const batch = files.slice(i, i + 100)
        const { error } = await admin.storage.from(BUCKET).remove(batch)
        if (error) return { ok: false, error: error.message }
        receiptsRemoved += batch.length
      }
    }

    return { ok: true, result, receiptsRemoved }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطای ناشناخته' }
  }
}
