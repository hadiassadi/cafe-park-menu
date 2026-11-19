'use server'

import { assertAdmin } from '@/lib/admin/assert-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 🎯 پچ ۵۱: ثبت/برداشتن کد کوتاه اپراتور (مثل «کد ۳») — در شرح اسناد و گزارش‌ها می‌آید
export async function setOperatorCode(formData: FormData): Promise<void> {
  try {
    await assertAdmin()
    const userId = String(formData.get('user_id') ?? '')
    const code = String(formData.get('code') ?? '')
      .replace(/[\s-]/g, '')
      .slice(0, 6)
    if (!userId) return

    const db = supabaseAdmin()
    if (!code) {
      // خالی = برداشتن کد
      await db.from('admin_operator_profiles').delete().eq('user_id', userId)
      revalidatePath('/admin/shifts')
      return
    }
    const { error } = await db
      .from('admin_operator_profiles')
      .upsert({
        user_id: userId,
        code,
        updated_at: new Date().toISOString(),
      })
    if (error) {
      // کد تکراری → index یکتا رد می‌کند
      console.error('[setOperatorCode]', error.message)
    }
    revalidatePath('/admin/shifts')
  } catch (err) {
    console.error('[setOperatorCode] unexpected:', err)
  }
}
