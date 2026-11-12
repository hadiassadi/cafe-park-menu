import 'server-only'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { BACKUP_BUCKET } from '@/lib/backup-sections'
import { buildFullPayload } from '@/lib/backup-core'

export const dynamic = 'force-dynamic'

// POST /api/admin/backup/store — ذخیرهٔ خودکار نسخهٔ کامل بکاپ روی سرور (پچ ۴۹-ج)
// کل payload سمت سرور ساخته می‌شود (بدون عبور از محدودیت حجم بدنهٔ درخواست) و داخل
// bucket خصوصی «backups» آپلود می‌شود؛ سپس آخرین ۱۰ نسخه نگه‌داری و تاریخچهٔ سروری
// در ستون backup_history جدول settings ثبت می‌شود (در نبود migration، بی‌سروصدا رد می‌شود).
const MAX_CLOUD_BACKUPS = 10
const HISTORY_LIMIT = 10

type HistoryEntry = {
  at: string
  file: string
  size: number
  rows: number
  files: number
}

export async function POST() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = supabaseAdmin()

    const payload = await buildFullPayload(db)
    const body = JSON.stringify(payload)
    const rows = Object.values(payload.counts).reduce((a, b) => a + b, 0)
    const files = Object.values(payload.storageCounts).reduce((a, b) => a + b, 0)

    const stamp = payload.createdAt.slice(0, 16).replace(/[:T]/g, '-')
    const fileName = `cafepark-backup-${stamp}.json`

    // bucket «backups» در صورت نبود ساخته می‌شود؛ خطای «از قبل موجود» طبیعی است
    await db.storage.createBucket(BACKUP_BUCKET, { public: false })

    const { error: uploadError } = await db.storage
      .from(BACKUP_BUCKET)
      .upload(fileName, body, {
        contentType: 'application/json; charset=utf-8',
        upsert: true,
      })
    if (uploadError) {
      throw new Error(`آپلود به سرور: ${uploadError.message}`)
    }

    // نگهداشت: حذف نسخه‌های قدیمی‌تر از سقف (جدیدترین ۱۰ نسخه می‌ماند)
    const { data: listed } = await db.storage.from(BACKUP_BUCKET).list('', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    const oldFiles = (listed ?? [])
      .filter((f) => f.id && f.name !== fileName)
      .slice(MAX_CLOUD_BACKUPS - 1)
    if (oldFiles.length > 0) {
      await db.storage.from(BACKUP_BUCKET).remove(oldFiles.map((f) => f.name))
    }

    // ثبت تاریخچهٔ سروری — اگر ستون backup_history موجود نباشد، بدون خطا رد می‌شود
    let historySaved = true
    let historyNote: string | undefined
    try {
      const { data: row } = await db
        .from('settings')
        .select('backup_history')
        .eq('id', 1)
        .maybeSingle()
      const prev = Array.isArray(row?.backup_history)
        ? (row?.backup_history as HistoryEntry[])
        : []
      const next: HistoryEntry[] = [
        { at: payload.createdAt, file: fileName, size: body.length, rows, files },
        ...prev,
      ].slice(0, HISTORY_LIMIT)
      const { error: histError } = await db
        .from('settings')
        .update({ backup_history: next })
        .eq('id', 1)
      if (histError) throw new Error(histError.message)
    } catch (e) {
      historySaved = false
      historyNote = e instanceof Error ? e.message : 'خطای نامشخص'
    }

    return NextResponse.json({
      ok: true,
      file: fileName,
      size: body.length,
      rows,
      files,
      createdAt: payload.createdAt,
      historySaved,
      historyNote,
    })
  } catch (err) {
    return apiError(err, 'خطا در ذخیرهٔ بکاپ روی سرور')
  }
}
