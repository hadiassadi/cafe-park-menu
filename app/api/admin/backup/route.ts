import 'server-only'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { BACKUP_SECTIONS, BACKUP_TABLES, STORAGE_BUCKETS, STORAGE_SECTION_KEY } from '@/lib/backup-sections'
import { buildFullPayload, collectStorage, contentTypeFor, fetchAllRows, storageTotals } from '@/lib/backup-core'

export const dynamic = 'force-dynamic'

const RESTORE_CHUNK = 500 // بازگردانی: تعداد ردیف در هر upsert
const MAX_RESTORE_ROWS = 5000 // سقف ردیف در هر درخواست بازگردانی
const MAX_RESTORE_FILES = 50 // سقف فایل در هر درخواست بازگردانی Storage

// ─────────────────────────────────────────────────────────────
// GET — بکاپ کامل یا بخش‌بندی‌شده (پچ ۴۹)
// ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = supabaseAdmin()

    // ─── حالت بخش‌بندی‌شده: /api/admin/backup?section=<key> ───
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

    // ─── بکاپ کامل (سازگار با نسخه‌های قبل) ───
    const payload = await buildFullPayload(db)

    const stamp = payload.createdAt.slice(0, 16).replace(/[:T]/g, '-')
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
