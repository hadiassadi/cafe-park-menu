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

export async function createManualEntry(formData: FormData): Promise<void> {
  try {
    const userId = await assertAdminId()
    const kind = String(formData.get('kind') ?? '')
    const amount = parseAmount(formData.get('amount'))
    const note = String(formData.get('note') ?? '').trim().slice(0, 200)
    const treTo = String(formData.get('tre_to') ?? '')
    const treFrom = String(formData.get('tre_from') ?? '')
    const cat = String(formData.get('cat') ?? '')
    if (!amount || amount > MAX_AMOUNT) return

    let debitAcc = '' // مقصد پول
    let creditAcc = '' // مبدا پول
    let desc = ''

    if (kind === 'receive') {
      if (!UUID_RE.test(treTo) || !UUID_RE.test(cat)) return
      debitAcc = treTo
      creditAcc = cat
    } else if (kind === 'pay') {
      if (!UUID_RE.test(treFrom) || !UUID_RE.test(cat)) return
      debitAcc = cat
      creditAcc = treFrom
    } else if (kind === 'transfer') {
      if (!UUID_RE.test(treFrom) || !UUID_RE.test(treTo)) return
      if (treFrom === treTo) return
      debitAcc = treTo
      creditAcc = treFrom
    } else {
      return
    }

    const db = supabaseAdmin()
    const ids = Array.from(new Set([debitAcc, creditAcc]))
    const { data: accs } = await db
      .from('gl_accounts')
      .select('id, name, kind, treasury_type, is_active')
      .in('id', ids)
    const byId: Record<string, any> = {}
    for (const a of accs ?? []) byId[a.id] = a
    const dAcc = byId[debitAcc]
    const cAcc = byId[creditAcc]
    if (!dAcc || !cAcc) return
    // اعتبارسنجی نوع حساب‌ها: خزانه فقط خزانه، دستهٔ دریافت/پرداخت فقط درآمد/هزینه
    if (kind === 'receive') {
      if (dAcc.kind !== 'treasury' || cAcc.kind !== 'income') return
    } else if (kind === 'pay') {
      if (dAcc.kind !== 'expense' || cAcc.kind !== 'treasury') return
    } else {
      if (dAcc.kind !== 'treasury' || cAcc.kind !== 'treasury') return
    }
    if (!dAcc.is_active || !cAcc.is_active) return

    if (kind === 'receive') {
      desc = `دریافت ${amount.toLocaleString('fa-IR')} — ${cAcc.name}${note ? ' — ' + note : ''}`
    } else if (kind === 'pay') {
      desc = `پرداخت ${amount.toLocaleString('fa-IR')} — ${dAcc.name}${note ? ' — ' + note : ''}`
    } else {
      desc = `انتقال ${amount.toLocaleString('fa-IR')} — ${cAcc.name} → ${dAcc.name}${note ? ' — ' + note : ''}`
    }

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
      console.error('[createManualEntry] entry:', entryErr?.message)
      return
    }
    const { error: linesErr } = await db.from('gl_lines').insert([
      { entry_id: entry.id, account_id: debitAcc, side: 'debit', amount },
      { entry_id: entry.id, account_id: creditAcc, side: 'credit', amount },
    ])
    if (linesErr) {
      console.error('[createManualEntry] lines:', linesErr.message)
      // بدون اقلام، سند بی‌معناست — پاکش می‌کنیم
      await db.from('gl_entries').delete().eq('id', entry.id)
      return
    }
    revalidatePath('/admin/treasury')
  } catch (err) {
    console.error('[createManualEntry] unexpected:', err)
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
    revalidatePath('/admin/treasury')
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
    revalidatePath('/admin/treasury')
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
    revalidatePath('/admin/treasury')
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
    revalidatePath('/admin/treasury')
  } catch (err) {
    console.error('[syncTreasuryAccounts] unexpected:', err)
  }
}
