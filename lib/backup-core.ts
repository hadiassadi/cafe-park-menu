// lib/backup-core.ts
// هستهٔ مشترک بکاپ (پچ ۴۹-ج): خواندن جداول + جمع‌آوری Storage + ساخت payload کامل.
// مصرف‌کنندگان: GET /api/admin/backup (بخشی و کامل) و POST /api/admin/backup/store (آپلود ابری)
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'
import { BACKUP_TABLES, STORAGE_BUCKETS } from '@/lib/backup-sections'

export type AdminDb = ReturnType<typeof supabaseAdmin>

export const PAGE_SIZE = 1000 // بکاپ: تعداد ردیف در هر کوئری
export const MAX_FILE_BYTES = 3 * 1024 * 1024 // سقف حجم هر فایل Storage داخل بکاپ
export const MAX_FILES_PER_BUCKET = 300 // سقف تعداد فایل در هر bucket

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

export function contentTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

// خواندن کامل یک جدول با صفحه‌بندی
export async function fetchAllRows(db: AdminDb, table: string) {
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
// برخلاف نسخهٔ قبل از پچ ۴۹، خطای دانلود «یک» فایل کل bucket را خراب نمی‌کند؛
// هر فایل جداگانه تلاش مجدد می‌شود و در صورت شکست با «علت» ثبت می‌شود.
export async function collectStorage(db: AdminDb) {
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

export function storageTotals(storage: Record<string, { name: string; data: string }[]>) {
  const storageCounts = Object.fromEntries(
    Object.entries(storage).map(([k, v]) => [k, v.length])
  )
  const files = Object.values(storageCounts).reduce((a, b) => a + b, 0)
  return { storageCounts, files }
}

export type FullBackupPayload = {
  app: string
  backupVersion: number
  createdAt: string
  counts: Record<string, number>
  skipped: Record<string, string>
  storageCounts: Record<string, number>
  storageSkipped: Record<string, string>
  tables: Record<string, unknown[]>
  storage: Record<string, { name: string; data: string }[]>
}

// ساخت payload کامل بکاپ — مشترک بین GET کامل و ذخیرهٔ ابری (پچ ۴۹-ج)
export async function buildFullPayload(db: AdminDb): Promise<FullBackupPayload> {
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

  return {
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
}
