'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

// بعد از هر تغییر در جملات یا تنظیمات (که از طریق API ذخیره می‌شوند)
// این تابع از صفحه ادمین صدا زده می‌شود تا منوی عمومی فوراً به‌روز شود.
// فقط برای کاربر واردشده کار می‌کند.
export async function revalidateMenu() {
  const db = await supabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) {
    return { error: 'اجازه دسترسی ندارید.' }
  }

  revalidatePath('/')
  return { success: true }
}
