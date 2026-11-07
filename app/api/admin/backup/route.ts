import 'server-only'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ترتیب جداول = ترتیب امن از نظر کلیدهای خارجی (اول والد، بعد فرزند).
// در بازگردانی هم همین ترتیب برای upsert استفاده می‌شود.
// توجه: 'theme-fonts'، 'product-images' و 'receipts' جدول نیستند؛ bucketهای Storage هستند
// و در STORAGE_BUCKETS پایین‌تر مدیریت می‌شوند.
const BACKUP_TABLES = [
  'settings',
  'club_settings',
  'tables',
  'cancellation_reasons',
  'themes',
  'categories',
  'organizations',
  'coupons',
  'products',
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
  'push_subscriptions',
  'club_settings_log',
] as const

// bucketهای Storage سوپابیس که فایل‌هایشان داخل بکاپ می‌آیند (base64)
const STORAGE_BUCKETS = ['product-images', 'receipts', 'theme-fonts'] as const

const PAGE_SIZE = 1000 // بکاپ: تعداد ردیف در هر کوئری
const RESTORE_CHUNK = 500 // بازگردانی: تعداد ردیف در هر upsert
const MAX_RESTORE_ROWS = 5000 // سقف ردیف در هر درخواست بازگردانی
const MAX_FILE_BYTES = 3 * 1024 * 1024 // سقف حجم هر فایل Storage داخل بکاپ
const MAX_FILES_PER_BUCKET = 300 // سقف تعداد فایل در هر bucket
const MAX_RESTORE_FILES = 50 // سقف فایل در هر درخواست بازگردانی Storage

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

function contentTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

// ─────────────────────────────────────────────────────────────
// GET — گرفتن بکاپ کامل (دانلود یک فایل JSON شامل همه‌ی جداول)
// ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = supabaseAdmin()
    const tables: Record<string, unknown[]> = {}
    // جدول‌هایی که در دیتابیس موجود نیستند یا خوانده نشدند؛
    // بکاپ به‌جای شکستن، آن‌ها را خالی ثبت می‌کند و ادامه می‌دهد
    const skipped: Record<string, string> = {}

    for (const table of BACKUP_TABLES) {
      try {
        const rows: unknown[] = []
        let from = 0
        for (;;) {
          const { data, error } = await db
            .from(table)
            .select('*')
            .range(from, from + PAGE_SIZE - 1)
          if (error) throw new Error(error.message)
          if (!data || data.length === 0) break
          rows.push(...data)
          if (data.length < PAGE_SIZE) break
          from += PAGE_SIZE
        }
        tables[table] = rows
      } catch (e) {
        tables[table] = []
        skipped[table] = e instanceof Error ? e.message : 'خطای نامشخص'
      }
    }

    // ─── فایل‌های Storage (تصاویر محصولات، رسیدها، فونت‌ها) ───
    const storage: Record<string, { name: string; data: string }[]> = {}
    const storageSkipped: Record<string, string> = {}

    for (const bucket of STORAGE_BUCKETS) {
      try {
        const { data: files, error } = await db.storage
          .from(bucket)
          .list('', {
            limit: MAX_FILES_PER_BUCKET,
            sortBy: { column: 'created_at', order: 'desc' },
          })
        if (error) throw new Error(error.message)

        const out: { name: string; data: string }[] = []
        for (const f of files ?? []) {
          if (!f.id) continue // پوشه‌های فرضی را رد کن
          const { data: blob, error: dlError } = await db.storage.from(bucket).download(f.name)
          if (dlError || !blob) throw new Error(`دانلود «${f.name}»: ${dlError?.message ?? 'داده خالی'}`)
          if (blob.size > MAX_FILE_BYTES) {
            storageSkipped[`${bucket}/${f.name}`] = 'حجم فایل از سقف مجاز بیشتر است'
            continue
          }
          const buf = Buffer.from(await blob.arrayBuffer())
          out.push({ name: f.name, data: buf.toString('base64') })
        }
        storage[bucket] = out
      } catch (e) {
        storage[bucket] = []
        storageSkipped[bucket] = e instanceof Error ? e.message : 'خطای نامشخص'
      }
    }

    const payload = {
      app: 'cafe-park-menu',
      backupVersion: 2,
      createdAt: new Date().toISOString(),
      counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
      skipped,
      storageCounts: Object.fromEntries(
        Object.entries(storage).map(([k, v]) => [k, v.length])
      ),
      storageSkipped,
      tables,
      storage,
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
// POST — بازگردانی (upsert) یک جدول یا فایل‌های Storage از روی فایل بکاپ
// بدنه‌ی جدول:  { confirm: 'بازگردانی', table: 'orders', rows: [...] }
// بدنه‌ی فایل:  { confirm: 'بازگردانی', bucket: 'receipts', files: [{ name, data }] }
// ردیف‌های موجود با نسخه‌ی بکاپ جایگزین می‌شوند و بقیه اضافه می‌شوند؛
// هیچ‌چیز حذف نمی‌شود (برای حذف، خود ردیف‌ها را دستی مدیریت کنید).
// ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const confirm = body?.confirm

    if (confirm !== 'بازگردانی') {
      return NextResponse.json(
        { error: 'عبارت تأیید درست نیست؛ باید دقیقاً «بازگردانی» تایپ شود' },
        { status: 400 }
      )
    }

    // ─── حالت Storage: بدنه { confirm, bucket, files: [{ name, data(base64) }] } ───
    const bucket = body?.bucket
    if (bucket !== undefined) {
      if (typeof bucket !== 'string' || !(STORAGE_BUCKETS as readonly string[]).includes(bucket)) {
        return NextResponse.json({ error: 'bucket نامعتبر است' }, { status: 400 })
      }
      const files = body?.files
      if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: 'فایلی برای بازگردانی نیست' }, { status: 400 })
      }
      if (files.length > MAX_RESTORE_FILES) {
        return NextResponse.json(
          { error: `تعداد فایل‌ها در هر درخواست حداکثر ${MAX_RESTORE_FILES} است` },
          { status: 413 }
        )
      }

      const db = supabaseAdmin()
      const results: { name: string; ok: boolean; error?: string }[] = []
      let uploaded = 0
      for (const file of files) {
        const name = file?.name
        const data = file?.data
        if (typeof name !== 'string' || typeof data !== 'string') {
          results.push({ name: String(name ?? '?'), ok: false, error: 'ساختار فایل نادرست است' })
          continue
        }
        try {
          const buf = Buffer.from(data, 'base64')
          const { error } = await db.storage.from(bucket).upload(name, buf, {
            contentType: contentTypeFor(name),
            upsert: true,
          })
          if (error) throw new Error(error.message)
          uploaded += 1
          results.push({ name, ok: true })
        } catch (e) {
          results.push({
            name,
            ok: false,
            error: e instanceof Error ? e.message : 'خطای نامشخص',
          })
        }
      }

      return NextResponse.json({ ok: true, bucket, uploaded, results })
    }

    const table = body?.table
    const rows = body?.rows

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
