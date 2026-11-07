import 'server-only'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ترتیب جداول = ترتیب امن از نظر کلیدهای خارجی (اول والد، بعد فرزند).
// در بازگردانی هم همین ترتیب برای upsert استفاده می‌شود.
const BACKUP_TABLES = [
  'settings',
  'club_settings',
  'tables',
  'cancellation_reasons',
  'themes',
  'theme-fonts',
  'categories',
  'organizations',
  'coupons',
  'products',
  'product-images',
  'variant_groups',
  'variant_options',
  'takeaway_fees',
  'organization_members',
  'customers',
  'membership_requests',
  'quotes',
  'orders',
  'order_payments',
  'order_refunds',
  'redemption_logs',
  'receipts',
  'push_subscriptions',
  'club_settings_log',
] as const

const PAGE_SIZE = 1000 // بکاپ: تعداد ردیف در هر کوئری
const RESTORE_CHUNK = 500 // بازگردانی: تعداد ردیف در هر upsert
const MAX_RESTORE_ROWS = 5000 // سقف ردیف در هر درخواست بازگردانی

// ─────────────────────────────────────────────────────────────
// GET — گرفتن بکاپ کامل (دانلود یک فایل JSON شامل همه‌ی جداول)
// ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = supabaseAdmin()
    const tables: Record<string, unknown[]> = {}

    for (const table of BACKUP_TABLES) {
      const rows: unknown[] = []
      let from = 0
      for (;;) {
        const { data, error } = await db
          .from(table)
          .select('*')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(`${table}: ${error.message}`)
        if (!data || data.length === 0) break
        rows.push(...data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      tables[table] = rows
    }

    const payload = {
      app: 'cafe-park-menu',
      backupVersion: 1,
      createdAt: new Date().toISOString(),
      counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
      tables,
    }

    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    const fileName = `cafepark-backup-${stamp}.json`

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return apiError(err, 'خطا در گرفتن بکاپ')
  }
}

// ─────────────────────────────────────────────────────────────
// POST — بازگردانی (upsert) یک جدول از روی فایل بکاپ
// بدنه: { confirm: 'بازگردانی', table: 'orders', rows: [...] }
// ردیف‌های موجود با نسخه‌ی بکاپ جایگزین می‌شوند و بقیه اضافه می‌شوند؛
// هیچ‌چیز حذف نمی‌شود (برای حذف، خود ردیف‌ها را دستی مدیریت کنید).
// ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const confirm = body?.confirm
    const table = body?.table
    const rows = body?.rows

    if (confirm !== 'بازگردانی') {
      return NextResponse.json(
        { error: 'عبارت تأیید درست نیست؛ باید دقیقاً «بازگردانی» تایپ شود' },
        { status: 400 }
      )
    }
    if (typeof table !== 'string' || !(BACKUP_TABLES as readonly string[]).includes(table)) {
      return NextResponse.json({ error: 'جدول نامعتبر است' }, { status: 400 })
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'ردیفی برای بازگردانی نیست' }, { status: 400 })
    }
    if (rows.length > MAX_RESTORE_ROWS) {
      return NextResponse.json(
        { error: `تعداد ردیف‌ها در هر درخواست حداکثر ${MAX_RESTORE_ROWS} است` },
        { status: 413 }
      )
    }

    const db = supabaseAdmin()
    let upserted = 0
    for (let i = 0; i < rows.length; i += RESTORE_CHUNK) {
      const chunk = rows.slice(i, i + RESTORE_CHUNK)
      const { error } = await db.from(table).upsert(chunk, { ignoreDuplicates: false })
      if (error) throw new Error(`${table}: ${error.message}`)
      upserted += chunk.length
    }

    return NextResponse.json({ ok: true, table, upserted })
  } catch (err) {
    return apiError(err, 'خطا در بازگردانی بکاپ')
  }
}
