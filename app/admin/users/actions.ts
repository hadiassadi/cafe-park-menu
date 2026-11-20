'use server'

import { assertPathAccess } from '@/lib/admin/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { toEnDigits } from '@/lib/wallet/charge'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۵ — فاز ۴-الف: کاربران و دسترسی
//   createStaffMember / updateStaffMember: فهرست کارکنان (staff_members)
//   toggleStaffMember / deleteStaffMember
//   setOperatorRole: نقش کاربر پنل (مالک/مدیر/صندوق‌دار/کارمند)
//   — اعمال نقش‌ها روی دسترسی بخش‌ها در پچ ۵۶ (فاز ۴-ب)
// ─────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
export async function setOperatorRole(fd: FormData): Promise<Res> {
  try {
    await assertPathAccess('/admin/users')
    const db = supabaseAdmin()
    const user_id = String(fd.get('user_id') ?? '')
    const email = String(fd.get('email') ?? '').trim().toLowerCase()
    if (!UUID_RE.test(user_id)) return { error: 'کاربر نامعتبر است' }
    const role = String(fd.get('role') ?? '')
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
        return { error: 'ثبت نقش انجام نشد' }
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
        return { error: 'ساخت پروفایل اپراتوری انجام نشد' }
      }
    }
    revalidatePath('/admin/users')
    return {}
  } catch (err: any) {
    console.error('[setOperatorRole] unexpected:', err)
    return { error: err?.message || 'خطای سرور' }
  }
}
