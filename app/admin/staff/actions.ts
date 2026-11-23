'use server'

import { revalidatePath } from 'next/cache'
import { getOperatorRole } from '@/lib/admin/roles'
import { accessAllowsPath } from '@/lib/admin/modules'
import { supabaseAdmin } from '@/lib/supabase/server'

// 🎯 پچ ۶۵ — اتصال کارمند به اکانت پنل از خود پنل (تا امروز فقط با SQL دستی
// قابل ثبت بود و اشتباهِ لینک، شیفت را به حساب نفر دیگری می‌نوشت).
// قواعد: هر اکانت پنل حداکثر به یک کارمند وصل است؛ اکانت مقصد باید پروفایل
// اپراتوری فعال داشته باشد (ورود شیفت پیامکی به پروفایل تکیه می‌کند).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Res = { error?: string }

export async function setStaffAuthLink(fd: FormData): Promise<Res> {
  try {
    const me = await getOperatorRole()
    if (!me) return { error: 'اول وارد پنل شو' }
    if (!accessAllowsPath(me.role, me.allowedPaths, '/admin/users')) {
      return { error: 'فقط دارندهٔ تیک «کاربران و دسترسی» می‌تواند اکانت‌ها را متصل کند' }
    }

    const db = supabaseAdmin()
    const staffId = Number(fd.get('staff_id'))
    const raw = String(fd.get('auth_user_id') ?? '').trim()
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return { error: 'کارمند نامعتبر است' }
    }

    const { data: staff } = await db
      .from('staff_members')
      .select('id, full_name, auth_user_id')
      .eq('id', staffId)
      .maybeSingle()
    if (!staff) return { error: 'کارمند پیدا نشد' }

    if (raw === 'none') {
      if (!staff.auth_user_id) return {}
      const { error } = await db
        .from('staff_members')
        .update({ auth_user_id: null })
        .eq('id', staffId)
      if (error) {
        console.error('[setStaffAuthLink] unlink:', error.message)
        return { error: `قطع اتصال انجام نشد — ${error.message}` }
      }
      revalidatePath('/admin/staff')
      revalidatePath(`/admin/staff/${staffId}`)
      return {}
    }

    if (!UUID_RE.test(raw)) return { error: 'اکانت پنل نامعتبر است' }

    // اکانت مقصد واقعاً وجود دارد؟
    const { data: target } = await db.auth.admin.getUserById(raw)
    if (!target?.user) return { error: 'این اکانت پنل در auth وجود ندارد' }

    // هر اکانت فقط به یک کارمند — تداخل را صریح رد کن
    const { data: clash } = await db
      .from('staff_members')
      .select('id, full_name')
      .eq('auth_user_id', raw)
      .neq('id', staffId)
      .maybeSingle()
    if (clash) {
      return {
        error: `این اکانت قبلاً به «${clash.full_name}» وصل است — اول اتصال او را قطع کن`,
      }
    }

    // اکانت مقصد باید پروفایل اپراتوری داشته باشد (پیش‌نیاز ورود شیفت پیامکی)
    const { data: prof } = await db
      .from('admin_operator_profiles')
      .select('user_id, is_active')
      .eq('user_id', raw)
      .maybeSingle()
    if (!prof) {
      return {
        error:
          'این اکانت پروفایل اپراتوری ندارد — اول از «کاربران و دسترسی» نقشش را ثبت کن، بعد متصل کن',
      }
    }
    if (prof.is_active === false) {
      return { error: 'پروفایل اپراتوری این اکانت غیرفعال است' }
    }

    const { error } = await db
      .from('staff_members')
      .update({ auth_user_id: raw })
      .eq('id', staffId)
    if (error) {
      console.error('[setStaffAuthLink] link:', error.message)
      return { error: `اتصال انجام نشد — ${error.message}` }
    }
    revalidatePath('/admin/staff')
    revalidatePath(`/admin/staff/${staffId}`)
    return {}
  } catch (err: any) {
    console.error('[setStaffAuthLink] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}
