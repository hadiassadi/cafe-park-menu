import 'server-only'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { BACKUP_SECTIONS, STORAGE_BUCKETS, STORAGE_SECTION_KEY } from '@/lib/backup-sections'

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

// bucketهای Storage از lib/backup-sections (منبع واحد برای بکاپ و بازگردانی) import می‌شود

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
// helpers مشترک بکاپ کامل و بخش‌بندی‌شده (پچ ۴۹)
// ─────────────────────────────────────────────────────────────

// خواندن کامل یک جدول با صفحه‌بندی
async function fetchAllRows(db: ReturnType<typeof supabaseAdmin>, table: string) {
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
  return rows
}

// جمع‌آوری فایل‌های Storage:
// برخلاف نسخهٔ قبلی، خطای دانلود «یک» فایل کل bucket را خراب نمی‌کند؛
// هر فایل جداگانه تلاش مجدد می‌شود و در صورت شکست با «علت» ثبت می‌شود.
async function collectStorage(db: ReturnType<typeof supabaseAdmin>) {
  const storage: Record<string, { name: string; data: string }[]> = {}
  const storageSkipped: Record<string, string> = {}

  for (const bucket of STORAGE_BUCKETS) {
    const out: { name: string; data: string }[] = []
    try {
      const { data: files, error } = await db.storage
        .from(bucket)
        .list('', {
          limit: MAX_FILES_PER_BUCKET,
          sortBy: { column: 'created_at', order: 'desc' },
        })
      if (error) throw new Error(error.message)

      for (const f of files ?? []) {
        if (!f.id) continue // پوشه‌های فرضی را رد کن
        const key = `${bucket}/${f.name}`

        // تلاش مجدد یک‌بار برای خطاهای گذرا
        let blob: Blob | null = null
        let lastErr = ''
        for (let attempt = 0; attempt < 2 && !blob; attempt++) {
          const { data, error: dlError } = await db.storage.from(bucket).download(f.name)
          if (!dlError && data) {
            blob = data
          } else {
            lastErr = dlError?.message ?? 'داده خالی'
            if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
          }
        }
        if (!blob) {
          storageSkipped[key] = `خطا در دانلود: ${lastErr}`
          continue
        }
        if (blob.size > MAX_FILE_BYTES) {
          storageSkipped[key] = `حجم ${(blob.size / 1048576).toFixed(1)}MB از سقف ۳ مگابایت بیشتر است`
          continue
        }
        const buf = Buffer.from(await blob.arrayBuffer())
        out.push({ name: f.name, data: buf.toString('base64') })
      }
      storage[bucket] = out
    } catch (e) {
      // خطای سطح bucket (مثلاً list) — فایل‌های همین‌جا گرفته‌شده حفظ می‌شوند
      storage[bucket] = out
      storageSkipped[bucket] = e instanceof Error ? e.message : 'خطای نامشخص'
    }
  }
  return { storage, storageSkipped }
}

function storageTotals(storage: Record<string, { name: string; data: string }[]>) {
  const storageCounts = Object.fromEntries(
    Object.entries(storage).map(([k, v]) => [k, v.length])
  )
  const files = Object.values(storageCounts).reduce((a, b) => a + b, 0)
  return { storageCounts, files }
}

// ─────────────────────────────────────────────────────────────
// GET — گرفتن بکاپ کامل (دانلود یک فایل JSON شامل همه‌ی جداول)
// ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = supabaseAdmin()

    // ─── حالت بخش‌بندی‌شده (پچ ۴۹): /api/admin/backup?section=<key> ───
    // هر بخش جداگانه خوانده می‌شود تا چک‌لیست زنده در UI ممکن شود؛
    // ادغام بخش‌ها سمت کلاینت همان ساختار payload بکاپ کامل را می‌سازد.
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section')
    if (section) {
      if (section === STORAGE_SECTION_KEY) {
        const { storage, storageSkipped } = await collectStorage(db)
        const { storageCounts, files } = storageTotals(storage)
        return NextResponse.json({
          ok: true,
          section,
          storage,
          storageCounts,
          storageSkipped,
          files,
        })
      }

      const sec = BACKUP_SECTIONS.find((s) => s.key === section)
      if (!sec) {
        return NextResponse.json({ error: 'بخش نامعتبر است' }, { status: 400 })
      }

      const tables: Record<string, unknown[]> = {}
      const skipped: Record<string, string> = {}
      let rows = 0
      for (const table of sec.tables) {
        try {
          tables[table] = await fetchAllRows(db, table)
          rows += tables[table].length
        } catch (e) {
          tables[table] = []
          skipped[table] = e instanceof Error ? e.message : 'خطای نامشخص'
        }
      }
      return NextResponse.json({ ok: true, section, rows, tables, skipped })
    }

    // ─── بکاپ کامل (سازگار با نسخهٔ قبل) ───
    const tables: Record<string, unknown[]> = {}
    // جدول‌هایی که در دیتابیس موجود نیستند یا خوانده نشدند؛
    // بکاپ به‌جای شکستن، آن‌ها را خالی ثبت می‌کند و ادامه می‌دهد
    const skipped: Record<string, string> = {}

    for (const table of BACKUP_TABLES) {
      try {
        tables[table] = await fetchAllRows(db, table)
      } catch (e) {
        tables[table] = []
        skipped[table] = e instanceof Error ? e.message : 'خطای نامشخص'
      }
    }

    const { storage, storageSkipped } = await collectStorage(db)

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
