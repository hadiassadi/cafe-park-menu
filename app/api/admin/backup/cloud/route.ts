import 'server-only'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireAdmin } from '@/lib/admin/require-admin'
import { supabaseAdmin } from '@/lib/supabase/server'
import { BACKUP_BUCKET } from '@/lib/backup-sections'

export const dynamic = 'force-dynamic'

// GET /api/admin/backup/cloud — فهرست نسخه‌های بکاپ ذخیره‌شده روی سرور (پچ ۴۹-ج)
// برای هر فایل یک URL امضاشدهٔ یک‌ساعته برمی‌گردد (bucket خصوصی است).
export async function GET() {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const db = supabaseAdmin()

    const { data: files, error } = await db.storage.from(BACKUP_BUCKET).list('', {
      limit: 50,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) {
      // bucket هنوز ساخته نشده = هنوز بکاپ ابری نداریم؛ لیست خالی، نه خطا
      return NextResponse.json({ ok: true, files: [] })
    }

    const existing = (files ?? []).filter((f) => f.id)
    const names = existing.map((f) => f.name)
    const { data: signed } = names.length
      ? await db.storage.from(BACKUP_BUCKET).createSignedUrls(names, 3600)
      : { data: [] }

    const out = existing.map((f) => ({
      name: f.name,
      size: f.metadata?.size ?? 0,
      createdAt: f.created_at,
      url: signed?.find((s) => s.path === f.name)?.signedUrl ?? null,
    }))

    return NextResponse.json({ ok: true, files: out })
  } catch (err) {
    return apiError(err, 'خطا در فهرست نسخه‌های سرور')
  }
}
