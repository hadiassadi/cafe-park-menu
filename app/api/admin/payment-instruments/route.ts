import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/require-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-و-الف: صندوق‌های نقدی و کارتخوان‌های فعال برای انتخاب در تسویهٔ POS
// 🎯 پچ ۵۰-و-ب: صندوقِ مالکِ همان اپراتور با is_mine=true علامت می‌خورد
// (پیش‌فرض تسویه) و فقط حساب‌های بانکی با تیک کارتخوان در فهرست کارت‌خوان‌ها می‌آیند
export async function GET(req: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.denied) return auth.denied
  const userId = auth.userId

  const rl = rateLimit(req, 'admin-payment-instruments', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const db = supabaseAdmin()
    const [regs, devs] = await Promise.all([
      db
        .from('cash_registers')
        .select('id, name, location, owner_id')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      db
        .from('pos_devices')
        .select('id, name, label, bank_name, card_number')
        .eq('is_active', true)
        .eq('is_card_reader', true)
        .order('created_at', { ascending: true }),
    ])
    if (regs.error) {
      console.error('[payment-instruments] registers:', regs.error.message)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }
    if (devs.error) {
      console.error('[payment-instruments] devices:', devs.error.message)
      return NextResponse.json({ error: 'خطای پایگاه داده' }, { status: 500 })
    }
    const registers = (regs.data ?? []).map(
      (r: Record<string, unknown>) => ({
        id: r.id,
        name: r.name,
        location: r.location ?? null,
        is_mine: r.owner_id === userId,
      })
    )
    const devices = (devs.data ?? []).map((d: Record<string, unknown>) => ({
      id: d.id,
      name: d.name,
      label: d.label ?? null,
      bank_name: d.bank_name ?? null,
      card_last4:
        typeof d.card_number === 'string' && d.card_number.length >= 4
          ? d.card_number.slice(-4)
          : null,
    }))
    return NextResponse.json(
      { registers, devices },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[payment-instruments] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
