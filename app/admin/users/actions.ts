'use server'

import { assertPathAccess } from '@/lib/admin/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { toEnDigits } from '@/lib/wallet/charge'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۵ — فاز ۴-الف: کاربران و دسترسی
//   createStaffMember / updateStaffMember: فهرست کارکنان (staff_members)
//   toggleStaffMember / deleteStaffMember
//   setOperatorRole: نقش کاربر پنل (مالک/مدیر/صندوق‌دار/کارمند/بدون دسترسی)
// 🎯 پچ ۵۷ — ساخت کاربر پنل از خود پنل:
//   createPanelUser: ایمیل+رمز از مودال (بدون پنل Supabase و بدون تغییر env)
//   setPanelUserPassword: تغییر/تنظیم رمز کاربر پنل
// ─────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STAFF_ROLES = [
  'owner',
  'manager',
  'cashier',
  'waiter',
  'kitchen',
  'staff',
] as const
const OP_ROLES = ['owner', 'manager', 'cashier', 'staff'] as const

type Res = { error?: string }

function cleanName(v: FormDataEntryValue | null): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

function cleanPhone(v: FormDataEntryValue | null): string | null {
  return toEnDigits(String(v ?? '')).replace(/\D/g, '') || null
}

// کارمند جدید فهرست کارکنان
export async function createStaffMember(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const full_name = cleanName(fd.get('full_name'))
    if (!full_name) return { error: 'نام کامل را وارد کن' }
    const role = String(fd.get('role') ?? 'staff')
    if (!STAFF_ROLES.includes(role as any))
      return { error: 'نقش نامعتبر است' }
    const phone = cleanPhone(fd.get('phone'))
    if (phone && (phone.length !== 11 || !phone.startsWith('09')))
      return { error: 'موبایل باید ۱۱ رقم و با ۰۹ شروع شود' }
    const note = String(fd.get('note') ?? '').trim().slice(0, 200) || null
    const { error } = await db
      .from('staff_members')
      .insert({ full_name, role, phone, note })
    if (error) {
      console.error('[createStaffMember]', error.message)
      return { error: 'ثبت کارمند انجام نشد' }
    }
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[createStaffMember] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}

// ویرایش کارمند موجود
export async function updateStaffMember(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const id = Number(fd.get('id'))
    if (!Number.isInteger(id) || id <= 0)
      return { error: 'کارمند نامعتبر است' }
    const full_name = cleanName(fd.get('full_name'))
    if (!full_name) return { error: 'نام کامل را وارد کن' }
    const role = String(fd.get('role') ?? 'staff')
    if (!STAFF_ROLES.includes(role as any))
      return { error: 'نقش نامعتبر است' }
    const phone = cleanPhone(fd.get('phone'))
    if (phone && (phone.length !== 11 || !phone.startsWith('09')))
      return { error: 'موبایل باید ۱۱ رقم و با ۰۹ شروع شود' }
    const note = String(fd.get('note') ?? '').trim().slice(0, 200) || null
    const { error } = await db
      .from('staff_members')
      .update({ full_name, role, phone, note })
      .eq('id', id)
    if (error) {
      console.error('[updateStaffMember]', error.message)
      return { error: 'ویرایش انجام نشد' }
    }
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[updateStaffMember] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}

// فعال/غیرفعال‌کردن کارمند (تاریخچه می‌ماند)
export async function toggleStaffMember(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const id = Number(fd.get('id'))
    if (!Number.isInteger(id) || id <= 0) return {}
    const { data: cur } = await db
      .from('staff_members')
      .select('is_active')
      .eq('id', id)
      .maybeSingle()
    if (!cur) return {}
    const { error } = await db
      .from('staff_members')
      .update({ is_active: !cur.is_active })
      .eq('id', id)
    if (error) console.error('[toggleStaffMember]', error.message)
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[toggleStaffMember] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}

// حذف کامل کارمند — فقط وقتی هیچ ردی ندارد (فعلاً هیچ FKای به این جدول نیست)
export async function deleteStaffMember(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const id = Number(fd.get('id'))
    if (!Number.isInteger(id) || id <= 0) return {}
    const { error } = await db.from('staff_members').delete().eq('id', id)
    if (error) {
      console.error('[deleteStaffMember]', error.message)
      return { error: 'حذف انجام نشد' }
    }
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[deleteStaffMember] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}

// نقش کاربر پنل — مبنای سطح دسترسی در پچ ۵۶
// (مالک: همه چیز + تایید خودکار بستن شیفت؛ مدیر/صندوق‌دار: محدودتر)
// نقش «none» = برداشتن دسترسی پنل (حذف پروفایل اپراتوری)
export async function setOperatorRole(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const user_id = String(fd.get('user_id') ?? '')
    const email = String(fd.get('email') ?? '').trim().toLowerCase()
    if (!UUID_RE.test(user_id)) return { error: 'کاربر نامعتبر است' }
    const role = String(fd.get('role') ?? '')

    if (role === 'none') {
      // 🎯 پچ ۵۷: برگرداندن اشتباه — کاربر بدون پروفایل دیگر وارد پنل نمی‌شود
      // (اگر ایمیلش در ADMIN_EMAILS باشد، دسترسی env با نقش پیش‌فرض کارمند می‌ماند)
      const { error } = await db
        .from('admin_operator_profiles')
        .delete()
        .eq('user_id', user_id)
      if (error) {
        console.error('[setOperatorRole] delete:', error.message)
        return { error: `حذف دسترسی انجام نشد — ${error.message}` }
      }
      revalidatePath('/admin/users')
      return {}
    }

    if (!OP_ROLES.includes(role as any))
      return { error: 'نقش نامعتبر است' }

    const { data: prof } = await db
      .from('admin_operator_profiles')
      .select('user_id')
      .eq('user_id', user_id)
      .maybeSingle()
    if (prof) {
      const { error } = await db
        .from('admin_operator_profiles')
        .update({ role })
        .eq('user_id', user_id)
      if (error) {
        console.error('[setOperatorRole] update:', error.message)
        return { error: `ثبت نقش انجام نشد — ${error.message}` }
      }
    } else {
      // پروفایل اپراتوری هنوز ساخته نشده — با نقش انتخابی می‌سازیم
      const { error } = await db
        .from('admin_operator_profiles')
        .insert({
          user_id,
          role,
          display_name: email.split('@')[0].slice(0, 40) || 'اپراتور',
        })
      if (error) {
        console.error('[setOperatorRole] insert:', error.message)
        // 🎯 پچ ۵۸: جزئیات خطا نمایش داده می‌شود — رایج‌ترین علت: قید CHECK قدیمی
        // نقش‌ها (پچ ۵۲-ب فقط owner/manager/operator را می‌پذیرفت) — SQL پچ ۵۸ لازم است
        return { error: `ثبت نقش انجام نشد — ${error.message}` }
      }
    }
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[setOperatorRole] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}

// 🎯 پچ ۵۷: کاربر پنل جدید از خود پنل — ایمیل + رمز (حداقل ۸ کاراکتر) + نقش.
// با سرویس‌کلید ساخته می‌شود (ایمیل تأیید‌شده)، پروفایل اپراتوری همان‌جا ثبت
// می‌شود و کاربر از /admin/login با همین ایمیل و رمز وارد می‌شود.
export async function createPanelUser(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const email = String(fd.get('email') ?? '').trim().toLowerCase()
    const password = String(fd.get('password') ?? '')
    const display_name =
      cleanName(fd.get('display_name')) ||
      email.split('@')[0].slice(0, 40) ||
      'اپراتور'
    const role = String(fd.get('role') ?? 'staff')
    if (!EMAIL_RE.test(email)) return { error: 'ایمیل نامعتبر است' }
    if (password.length < 8)
      return { error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' }
    if (!OP_ROLES.includes(role as any))
      return { error: 'نقش نامعتبر است' }

    const { data: created, error: createErr } = await db.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true,
      }
    )
    if (createErr || !created?.user) {
      console.error('[createPanelUser]', createErr?.message)
      if (/already|registered|duplicate|been/i.test(createErr?.message || ''))
        return {
          error:
            'این ایمیل قبلاً ثبت شده است — اگر کاربرش را در لیست می‌بینی، فقط نقشش را از جدول ثبت کن',
        }
      return {
        error: `ساخت کاربر انجام نشد — ${createErr?.message || 'خطای ناشناخته'}`,
      }
    }

    const { error: profErr } = await db
      .from('admin_operator_profiles')
      .insert({ user_id: created.user.id, role, display_name })
    if (profErr) {
      console.error('[createPanelUser] profile:', profErr.message)
      // 🎯 پچ ۵۸: کاربر auth ساخته شده — زامبی نمی‌ماند: از جدول (با تیک نمایش
      // همه) نقشش را ثبت کن؛ اگر SQL پچ ۵۸ اجرا نشده باشد، جزئیات همان‌جا می‌آید
      return {
        error: `کاربر ساخته شد ولی ثبت نقش انجام نشد — ${profErr.message} — از جدول، نقش را دوباره ثبت کن`,
      }
    }
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[createPanelUser] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}

// 🎯 پچ ۵۷: تغییر/تنظیم رمز کاربر پنل (فراموشی رمز یا اولین ورود کارمند)
export async function setPanelUserPassword(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const user_id = String(fd.get('user_id') ?? '')
    const password = String(fd.get('password') ?? '')
    if (!UUID_RE.test(user_id)) return { error: 'کاربر نامعتبر است' }
    if (password.length < 8)
      return { error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' }
    const { error } = await db.auth.admin.updateUserById(user_id, {
      password,
    })
    if (error) {
      console.error('[setPanelUserPassword]', error.message)
      return { error: `تغییر رمز انجام نشد — ${error.message}` }
    }
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[setPanelUserPassword] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}
