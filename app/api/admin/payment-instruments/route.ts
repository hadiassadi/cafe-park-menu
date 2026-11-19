import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin/assert-admin'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 🎯 پچ ۵۰-و-الف: صندوق‌های نقدی و کارتخوان‌های فعال برای انتخاب در تسویهٔ POS
export async function GET(req: NextRequest) {
  const denied = await guardAdmin()
  if (denied) return NextResponse.json(denied, { status: 403 })

  const rl = rateLimit(req, 'admin-payment-instruments', 60, 60_000)
  if (!rl.ok) return tooMany(rl)

  try {
    const db = supabaseAdmin()
    const [regs, devs] = await Promise.all([
      db
        .from('cash_registers')
        .select('id, name, location')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      db
        .from('pos_devices')
        .select('id, name, label')
        .eq('is_active', true)
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
    return NextResponse.json(
      { registers: regs.data ?? [], devices: devs.data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[payment-instruments] unexpected:', err)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
