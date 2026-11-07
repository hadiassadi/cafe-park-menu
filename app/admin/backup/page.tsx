'use client'

import { useRef, useState } from 'react'

type StorageFile = { name: string; data: string }

type BackupMeta = {
  app?: string
  backupVersion?: number
  createdAt?: string
  counts?: Record<string, number>
  skipped?: Record<string, string>
  tables?: Record<string, unknown[]>
  storage?: Record<string, StorageFile[]>
  storageSkipped?: Record<string, string>
}

// نسخه‌های پشتیبانی‌شده: ۱ = فقط جداول، ۲ = جداول + فایل‌های Storage
const BACKUP_VERSION_OK = (v?: number) => v === 1 || v === 2

type RestoreProgress = {
  table: string
  done: number
  total: number
}

type RestoreReport = {
  table: string
  upserted: number
  error?: string
}

const RESTORE_WORD = 'بازگردانی'
const CLIENT_CHUNK = 500 // هر بار حداکثر این تعداد ردیف به سرور فرستاده می‌شود (زیر سقف 4.5MB بدنه‌ی درخواست Vercel)

function fa(n: number): string {
  return n.toLocaleString('fa-IR')
}

export default function AdminBackupPage() {
  // ─── بکاپ ───
  const [backingUp, setBackingUp] = useState(false)
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)

  // ─── بازگردانی ───
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<BackupMeta | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)
  const [report, setReport] = useState<RestoreReport[] | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const totalRows = (meta: BackupMeta | null) =>
    meta?.counts ? Object.values(meta.counts).reduce((a, b) => a + b, 0) : 0

  const totalStorageFiles = (meta: BackupMeta | null) =>
    meta?.storage ? Object.values(meta.storage).reduce((a, b) => a + b.length, 0) : 0

  // ───────────────── گرفتن بکاپ ─────────────────
  const handleBackup = async () => {
    setBackingUp(true)
    setBackupError(null)
    setBackupMeta(null)
    try {
      const res = await fetch('/api/admin/backup', { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `خطای سرور (${res.status})`)
      }
      const text = await res.text()
      const meta = JSON.parse(text) as BackupMeta
      if (!BACKUP_VERSION_OK(meta?.backupVersion) || !meta.tables) {
        throw new Error('ساختار فایل بکاپ معتبر نیست')
      }

      // ذخیره‌ی فایل
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const name = match?.[1] || `cafepark-backup-${Date.now()}.json`
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setBackupMeta(meta)
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : 'خطای نامشخص')
    } finally {
      setBackingUp(false)
    }
  }

  // ───────────────── انتخاب فایل بکاپ ─────────────────
  const handleFile = async (file: File | null) => {
    setParsed(null)
    setReport(null)
    setRestoreError(null)
    setConfirmText('')
    setProgress(null)
    if (!file) return
    setFileName(file.name)
    try {
      const text = await file.text()
      const meta = JSON.parse(text) as BackupMeta
      if (!BACKUP_VERSION_OK(meta?.backupVersion) || !meta.tables) {
        throw new Error('این فایل بکاپ کافه پارک نیست یا نسخه‌ی آن پشتیبانی نمی‌شود')
      }
      setParsed(meta)
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'فایل قابل خواندن نیست')
    }
  }

  // ───────────────── بازگردانی ─────────────────
  const handleRestore = async () => {
    if (!parsed?.tables) return
    setRestoring(true)
    setRestoreError(null)
    setReport([])

    const reportAcc: RestoreReport[] = []

    try {
      // ترتیب جداول داخل فایل بکاپ همان ترتیب امن از نظر FK است
      for (const [table, rows] of Object.entries(parsed.tables)) {
        if (!Array.isArray(rows) || rows.length === 0) continue

        for (let i = 0; i < rows.length; i += CLIENT_CHUNK) {
          const chunk = rows.slice(i, i + CLIENT_CHUNK)
          setProgress({ table, done: Math.min(i + CLIENT_CHUNK, rows.length), total: rows.length })

          const res = await fetch('/api/admin/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: RESTORE_WORD, table, rows: chunk }),
          })
          const j = await res.json().catch(() => null)
          if (!res.ok || !j?.ok) {
            throw new Error(
              `جدول «${table}»: ${j?.error || `خطای سرور (${res.status})`}`
            )
          }
          reportAcc.push({ table, upserted: j.upserted ?? 0 })
        }
      }

      // ─── بازگردانی فایل‌های Storage (چانک بر اساس حجم، زیر سقف بدنه‌ی درخواست) ───
      for (const [bucket, files] of Object.entries(parsed.storage ?? {})) {
        if (!Array.isArray(files) || files.length === 0) continue

        let chunk: StorageFile[] = []
        let chunkBytes = 0
        let done = 0

        const flush = async () => {
          if (chunk.length === 0) return
          setProgress({ table: `📁 ${bucket}`, done, total: files.length })

          const res = await fetch('/api/admin/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: RESTORE_WORD, bucket, files: chunk }),
          })
          const j = await res.json().catch(() => null)
          if (!res.ok || !j?.ok) {
            throw new Error(`bucket «${bucket}»: ${j?.error || `خطای سرور (${res.status})`}`)
          }
          const results = (j.results ?? []) as { name: string; ok: boolean; error?: string }[]
          for (const r of results) {
            reportAcc.push({
              table: `📁 ${bucket}/${r.name}`,
              upserted: r.ok ? 1 : 0,
              error: r.ok ? undefined : r.error ?? 'خطا',
            })
          }
          done += chunk.length
          chunk = []
          chunkBytes = 0
        }

        for (const file of files) {
          const bytes = file.data.length * 0.75
          if (chunkBytes + bytes > 2_500_000 && chunk.length > 0) await flush()
          chunk.push(file)
          chunkBytes += bytes
        }
        await flush()
      }

      // جمع گزارش به‌ازای هر جدول
      const merged: Record<string, RestoreReport> = {}
      for (const r of reportAcc) {
        if (!merged[r.table]) merged[r.table] = { table: r.table, upserted: 0 }
        merged[r.table].upserted += r.upserted
      }
      setReport(Object.values(merged))
      setProgress(null)
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'خطای نامشخص در بازگردانی')
      setProgress(null)
      setReport(reportAcc)
    } finally {
      setRestoring(false)
    }
  }

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  }
  const btn: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    color: '#fff',
    background: '#7c3aed',
  }
  const btnDanger: React.CSSProperties = { ...btn, background: '#dc2626' }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>💾 پشتیبان‌گیری</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>
        بکاپ شامل داده‌های دیتابیس (سفارش‌ها، محصولات، مشتریان و…) به‌علاوه‌ی فایل‌های
        Storage (تصاویر محصولات، رسیدها، فونت‌ها) است. این فایل را در جای امن نگه دارید.
      </p>

      {/* گرفتن بکاپ */}
      <div style={card}>
        <h2 style={{ fontSize: 17, marginBottom: 8 }}>گرفتن بکاپ</h2>
        <p style={{ color: '#6b7280', marginBottom: 12 }}>
          یک فایل JSON از همه‌ی جداول ساخته می‌شود و دانلود می‌شود. این فایل را در جای
          امن نگه دارید (ایمیل، هارد اکسترنال، درایو ابری).
        </p>
        <button style={btn} onClick={handleBackup} disabled={backingUp}>
          {backingUp ? 'در حال گرفتن بکاپ…' : '⬇️ دانلود بکاپ کامل'}
        </button>

        {backupError && (
          <div style={{ color: '#dc2626', marginTop: 12 }}>خطا: {backupError}</div>
        )}
        {backupMeta && (
          <div style={{ marginTop: 12, color: '#16a34a', fontWeight: 600 }}>
            ✅ بکاپ گرفته شد — {fa(totalRows(backupMeta))} ردیف از{' '}
            {fa(backupMeta.tables ? Object.keys(backupMeta.tables).length : 0)} جدول
            {totalStorageFiles(backupMeta) > 0 &&
              ` + ${fa(totalStorageFiles(backupMeta))} فایل از ${
                backupMeta.storage ? Object.keys(backupMeta.storage).length : 0
              } پوشه`}
          </div>
        )}
        {backupMeta?.skipped && Object.keys(backupMeta.skipped).length > 0 && (
          <div style={{ marginTop: 8, color: '#b45309', fontSize: 13 }}>
            ⚠️ جدول‌های ردشده چون در دیتابیس موجود نیستند:{' '}
            {Object.keys(backupMeta.skipped).join('، ')}
          </div>
        )}
        {backupMeta?.storageSkipped && Object.keys(backupMeta.storageSkipped).length > 0 && (
          <div style={{ marginTop: 8, color: '#b45309', fontSize: 13 }}>
            ⚠️ موارد ردشده از Storage: {Object.keys(backupMeta.storageSkipped).join('، ')}
          </div>
        )}
      </div>

      {/* بازگردانی */}
      <div style={card}>
        <h2 style={{ fontSize: 17, marginBottom: 8 }}>بازگردانی از فایل بکاپ</h2>
        <p style={{ color: '#6b7280', marginBottom: 12 }}>
          ردیف‌های فایل بکاپ روی دیتابیس فعلی <b>upsert</b> می‌شوند: ردیف‌های موجود با
          نسخه‌ی بکاپ جایگزین و بقیه اضافه می‌شوند. هیچ داده‌ای حذف نمی‌شود.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: 12 }}
        />

        {fileName && (
          <div style={{ marginBottom: 8, color: '#6b7280' }}>فایل انتخاب‌شده: {fileName}</div>
        )}

        {parsed && (
          <div
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              تاریخ بکاپ: {parsed.createdAt ? new Date(parsed.createdAt).toLocaleString('fa-IR') : '—'}
            </div>
            <div>
              مجموع {fa(totalRows(parsed))} ردیف از {fa(parsed.tables ? Object.keys(parsed.tables).length : 0)} جدول
              {totalStorageFiles(parsed) > 0 &&
                ` + ${fa(totalStorageFiles(parsed))} فایل Storage`}
            </div>
          </div>
        )}

        {parsed && (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              برای تأیید، عبارت «{RESTORE_WORD}» را تایپ کنید:
            </label>
            <input
              style={{ ...inputStyle, marginBottom: 12 }}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={RESTORE_WORD}
              disabled={restoring}
            />
            <button
              style={btnDanger}
              onClick={handleRestore}
              disabled={restoring || confirmText !== RESTORE_WORD}
            >
              {restoring ? 'در حال بازگردانی…' : '♻️ شروع بازگردانی'}
            </button>
          </>
        )}

        {progress && (
          <div style={{ marginTop: 12, color: '#6b7280' }}>
            در حال بازگردانی «{progress.table}»: {fa(progress.done)} از {fa(progress.total)} ردیف…
          </div>
        )}

        {restoreError && (
          <div style={{ color: '#dc2626', marginTop: 12 }}>خطا: {restoreError}</div>
        )}

        {report && report.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>نتیجه‌ی بازگردانی:</div>
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 8,
              }}
            >
              {report.map((r) => (
                <div key={r.table} style={{ padding: '2px 0' }}>
                  {r.error ? '❌' : '✅'} <b>{r.table}</b>: {fa(r.upserted)} ردیف
                  {r.error ? ` — ${r.error}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
