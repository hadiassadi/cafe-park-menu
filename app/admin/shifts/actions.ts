'use server'

import { assertAdminId } from '@/lib/admin/assert-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۲ — اکشن‌های گردش کامل شیفت:
//   saveOperatorProfile: نام نمایشی + کد + ساعات کاری مجاز هر اپراتور
//   approveShift: تایید گزارش بستن (چهارچشم — خودِ اپراتور نمی‌تواند تایید کند)
//   forceCloseShift: بستن اجباری شیفتِ فراموش‌شده توسط مدیر
// ─────────────────────────────────────────────

const TIME_RE = /^\d{2}:\d{2}$/

// نام نمایشی کاربر برای اسنپ‌شات
async function userName(db: ReturnType<typeof supabaseAdmin>, userId: string) {
  try {
    const { data } = await db.auth.admin.getUserById(userId)
    const u: any = data?.user
    return (
      (typeof u?.user_metadata?.full_name === 'string' &&
        u.user_metadata.full_name.trim()) ||
      u?.email ||
      'کاربر'
    )
  } catch {
    return 'کاربر'
  }
}

export async function saveOperatorProfile(formData: FormData): Promise<void> {
  try {
    await assertAdminId()
    const userId = String(formData.get('user_id') ?? '')
    if (!userId) return
    const displayName = String(formData.get('display_name') ?? '')
      .trim()
      .slice(0, 40)
    const code = String(formData.get('code') ?? '')
      .replace(/[\s-]/g, '')
      .slice(0, 6)
    const start = String(formData.get('shift_start_time') ?? '').trim()
    const end = String(formData.get('shift_end_time') ?? '').trim()
    const roleRaw = String(formData.get('role') ?? 'operator')
    const role = ['owner', 'manager', 'operator'].includes(roleRaw)
      ? roleRaw
      : 'operator'

    const db = supabaseAdmin()
    // 🎯 پچ ۵۲-ج: ذخیرهٔ فرم خالی دیگر پروفایل را پاک نمی‌کند — فقط به پیش‌فرض برمی‌گردد
    // (قبلاً یک ذخیرهٔ خالی، کد و نام صاحب را پاک می‌کرد — ریسک پاک‌شدن تصادفی)
    const { error } = await db.from('admin_operator_profiles').upsert({
      user_id: userId,
      display_name: displayName || null,
      code: code || null,
      shift_start_time: TIME_RE.test(start) ? start : null,
      shift_end_time: TIME_RE.test(end) ? end : null,
      role,
      updated_at: new Date().toISOString(),
    })
    // کد تکراری → index یکتا رد می‌کند
    if (error) console.error('[saveOperatorProfile]', error.message)
    revalidatePath('/admin/shifts')
  } catch (err) {
    console.error('[saveOperatorProfile] unexpected:', err)
  }
}

export async function approveShift(formData: FormData): Promise<void> {
  try {
    const userId = await assertAdminId()
    const shiftId = String(formData.get('shift_id') ?? '')
    if (!shiftId) return
    const db = supabaseAdmin()
    const { data: s } = await db
      .from('shifts')
      .select('id, opened_by, closed_at, approved_by')
      .eq('id', shiftId)
      .maybeSingle()
    if (!s?.closed_at || s.approved_by) return
    if (s.opened_by === userId) {
      // چهارچشم: شیفتت را خودت نمی‌توانی تایید کنی
      console.error('[approveShift] owner cannot approve own shift')
      return
    }
    const { error } = await db
      .from('shifts')
      .update({ approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', shiftId)
      .is('approved_by', null)
    if (error) console.error('[approveShift]', error.message)
    revalidatePath('/admin/shifts')
  } catch (err) {
    console.error('[approveShift] unexpected:', err)
  }
}

export async function forceCloseShift(formData: FormData): Promise<void> {
  try {
    const userId = await assertAdminId()
    const shiftId = String(formData.get('shift_id') ?? '')
    const note = String(formData.get('note') ?? '').trim().slice(0, 200)
    if (!shiftId) return
    const db = supabaseAdmin()
    const { data: s } = await db
      .from('shifts')
      .select('id, opened_by, closed_at, opening_float')
      .eq('id', shiftId)
      .maybeSingle()
    if (!s || s.closed_at) return
    if (s.opened_by === userId) {
      // شیفت خودت را از چیپ صفحات ببند (شمارش واقعی آنجا معنا دارد)
      console.error('[forceCloseShift] own shift — use the chip')
      return
    }

    const [pays, ords, openOrds] = await Promise.all([
      db
        .from('order_payments')
        .select('method, amount')
        .eq('shift_id', shiftId)
        .eq('status', 'confirmed'),
      db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('shift_id', shiftId),
      db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('shift_id', shiftId)
        .neq('status', 'cancelled')
        .neq('payment_status', 'paid'),
    ])
    const totals = {
      cash: 0,
      card: 0,
      online: 0,
      transfer: 0,
      orders_count: ords.count ?? 0,
    }
    for (const p of pays.data ?? []) {
      const a = Number((p as any).amount) || 0
      const m = (p as any).method
      if (m === 'cash') totals.cash += a
      else if (m === 'card') totals.card += a
      else if (m === 'online') totals.online += a
      else if (m === 'transfer') totals.transfer += a
    }

    const myName = await userName(db, userId)

    // 🎯 پچ ۵۲-ب: اگر شیفتِ بسته‌شده مال «صاحب» است، بدون تایید ثبت می‌شود
    const { data: ownerProf } = await db
      .from('admin_operator_profiles')
      .select('role')
      .eq('user_id', s.opened_by)
      .maybeSingle()
    const ownerAuto =
      ownerProf?.role === 'owner'
        ? { approved_by: userId, approved_at: new Date().toISOString() }
        : {}

    const { error } = await db
      .from('shifts')
      .update({
        closed_at: new Date().toISOString(),
        closed_by: userId,
        closed_by_name: myName,
        ...ownerAuto,
        counted_cash: null,
        expected_cash: Number(s.opening_float) + totals.cash,
        discrepancy: null,
        closing_totals: totals,
        closing_open_orders: openOrds.count ?? 0,
        closing_note: note
          ? `بستن اجباری توسط مدیر — ${note}`
          : 'بستن اجباری توسط مدیر (بدون شمارش — مغایرت ثبت نشد)',
      })
      .eq('id', shiftId)
      .is('closed_at', null)
    if (error) console.error('[forceCloseShift]', error.message)
    revalidatePath('/admin/shifts')
  } catch (err) {
    console.error('[forceCloseShift] unexpected:', err)
  }
}
