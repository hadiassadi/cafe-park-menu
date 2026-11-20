'use server'

import { assertAdminId } from '@/lib/admin/assert-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { toEnDigits } from '@/lib/wallet/charge'

// ─────────────────────────────────────────────
// 🎯 پچ ۵۳ — خزانه و حسابداری پایه:
//   createManualEntry: سند دستی دریافت/پرداخت/انتقال (دوطرفه: دو قلم بدهکار/بستانکار)
//   deleteManualEntry: حذف سند دستی (اسناد خودکار POS حذف نمی‌شوند)
//   createAccount: سرفصل درآمد/هزینه یا حساب بانکی جدید
//   deactivateAccount: غیرفعال‌کردن حساب
//   syncTreasuryAccounts: همگام‌سازی حساب‌های خزانه از صندوق‌ها/کارت‌خوان‌ها
// ─────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AMOUNT = 500_000_000

function parseAmount(v: FormDataEntryValue | null): number {
  const n = Math.floor(
    Number(toEnDigits(String(v ?? '')).replace(/[^\d]/g, ''))
  )
  return Number.isFinite(n) && n > 0 ? n : 0
}

// نام نمایشی ثبت‌کنندهٔ سند: اول پروفایل اپراتوری، بعد ایمیل
async function myName(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string
): Promise<string> {
  try {
    const { data: p } = await db
      .from('admin_operator_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle()
    if (p?.display_name?.trim()) return p.display_name.trim()
  } catch {
    // ادامه با fallback
  }
  try {
    const { data } = await db.auth.admin.getUserById(userId)
    return (data?.user as any)?.email || 'مدیر'
  } catch {
    return 'مدیر'
  }
}

// 🎯 پچ ۵۳-ب: سند چندردیفه به سبک نرم‌افزارهای حسابداری (Xero/سپیدار) —
// هر ردیف: حساب + شرح مخصوص + فقط یکی از بدهکار/بستانکار؛ سند باید متوازن باشد
export async function createManualJournal(formData: FormData): Promise<void> {
  try {
    const userId = await assertAdminId()
    const entryDesc = String(formData.get('entry_desc') ?? '')
      .trim()
      .slice(0, 200)

    // ردیف‌ها: line_acc_i / line_desc_i / line_debit_i / line_credit_i
    type Row = { acc: string; desc: string; debit: number; credit: number }
    const rows: Row[] = []
    for (let i = 0; i < 40; i++) {
      const acc = String(formData.get(`line_acc_${i}`) ?? '')
      if (!UUID_RE.test(acc)) continue
      const debit = parseAmount(formData.get(`line_debit_${i}`))
      const credit = parseAmount(formData.get(`line_credit_${i}`))
      const desc = String(formData.get(`line_desc_${i}`) ?? '')
        .trim()
        .slice(0, 200)
      if (!debit && !credit) continue // ردیف خالی — رد
      if (debit && credit) return // یک ردیف فقط یک طرف می‌تواند داشته باشد
      rows.push({ acc, desc, debit, credit })
    }
    if (rows.length < 2) return // سند حداقل دو قلم
    const sumD = rows.reduce((s, r) => s + r.debit, 0)
    const sumC = rows.reduce((s, r) => s + r.credit, 0)
    if (sumD !== sumC || sumD > MAX_AMOUNT) return // عدم توازن یا مبلغ غیرمجاز

    const db = supabaseAdmin()
    const ids = Array.from(new Set(rows.map((r) => r.acc)))
    const { data: accs } = await db
      .from('gl_accounts')
      .select('id, is_active')
      .in('id', ids)
    const activeIds = new Set((accs ?? []).map((a: any) => a.id))
    if (rows.some((r) => !activeIds.has(r.acc))) return // حساب نامعتبر/غیرفعال

    const desc =
      entryDesc ||
      `سند دستی — ${rows.length.toLocaleString('fa-IR')} قلم — جمع ${sumD.toLocaleString('fa-IR')}`
    const creator = await myName(db, userId)
    const { data: entry, error: entryErr } = await db
      .from('gl_entries')
      .insert({
        description: desc,
        source: 'manual',
        created_by: userId,
        created_by_name: creator,
      })
      .select('id')
      .single()
    if (entryErr || !entry) {
      console.error('[createManualJournal] entry:', entryErr?.message)
      return
    }
    const { error: linesErr } = await db.from('gl_lines').insert(
      rows.map((r) => ({
        entry_id: entry.id,
        account_id: r.acc,
        side: r.debit ? 'debit' : 'credit',
        amount: r.debit || r.credit,
        description: r.desc || null,
      }))
    )
    if (linesErr) {
      console.error('[createManualJournal] lines:', linesErr.message)
      // بدون اقلام، سند بی‌معناست — پاکش می‌کنیم
      await db.from('gl_entries').delete().eq('id', entry.id)
      return
    }
    revalidatePath('/admin/accounting')
  } catch (err) {
    console.error('[createManualJournal] unexpected:', err)
  }
}

export async function deleteManualEntry(formData: FormData): Promise<void> {
  try {
    await assertAdminId()
    const entryId = String(formData.get('entry_id') ?? '')
    if (!UUID_RE.test(entryId)) return
    const db = supabaseAdmin()
    const { data: e } = await db
      .from('gl_entries')
      .select('id, source')
      .eq('id', entryId)
      .maybeSingle()
    if (!e || e.source !== 'manual') return // اسناد خودکار POS قابل حذف نیستند
    await db.from('gl_lines').delete().eq('entry_id', entryId)
    await db.from('gl_entries').delete().eq('id', entryId)
    revalidatePath('/admin/accounting')
  } catch (err) {
    console.error('[deleteManualEntry] unexpected:', err)
  }
}

export async function createAccount(formData: FormData): Promise<void> {
  try {
    await assertAdminId()
    const name = String(formData.get('name') ?? '')
      .trim()
      .slice(0, 40)
    const choice = String(formData.get('choice') ?? '')
    if (!name) return
    const db = supabaseAdmin()
    if (choice === 'income' || choice === 'expense') {
      const { error } = await db
        .from('gl_accounts')
        .insert({ kind: choice, name })
      if (error) console.error('[createAccount]', error.message)
    } else if (choice === 'bank') {
      const { error } = await db
        .from('gl_accounts')
        .insert({ kind: 'treasury', treasury_type: 'bank', name })
      if (error) console.error('[createAccount]', error.message)
    } else {
      return
    }
    revalidatePath('/admin/accounting')
  } catch (err) {
    console.error('[createAccount] unexpected:', err)
  }
}

export async function deactivateAccount(formData: FormData): Promise<void> {
  try {
    await assertAdminId()
    const id = String(formData.get('account_id') ?? '')
    if (!UUID_RE.test(id)) return
    const db = supabaseAdmin()
    const { error } = await db
      .from('gl_accounts')
      .update({ is_active: false })
      .eq('id', id)
    if (error) console.error('[deactivateAccount]', error.message)
    revalidatePath('/admin/accounting')
  } catch (err) {
    console.error('[deactivateAccount] unexpected:', err)
  }
}

export async function syncTreasuryAccounts(formData: FormData): Promise<void> {
  try {
    await assertAdminId()
    const db = supabaseAdmin()
    const [regs, devs] = await Promise.all([
      db.from('cash_registers').select('id, name').eq('is_active', true),
      db
        .from('pos_devices')
        .select('id, name')
        .eq('is_active', true)
        .eq('is_card_reader', true),
    ])
    const rows: any[] = []
    for (const r of regs.data ?? []) {
      rows.push({
        kind: 'treasury',
        treasury_type: 'cash',
        name: r.name,
        ref_register_id: r.id,
        slug: `tre-cash-${r.id}`,
        sort: 10,
      })
    }
    for (const d of devs.data ?? []) {
      rows.push({
        kind: 'treasury',
        treasury_type: 'card_reader',
        name: d.name,
        ref_device_id: d.id,
        slug: `tre-card-${d.id}`,
        sort: 12,
      })
    }
    if (rows.length > 0) {
      const { error } = await db
        .from('gl_accounts')
        .upsert(rows, { onConflict: 'slug', ignoreDuplicates: true })
      if (error) console.error('[syncTreasuryAccounts]', error.message)
    }
    revalidatePath('/admin/accounting')
  } catch (err) {
    console.error('[syncTreasuryAccounts] unexpected:', err)
  }
}
