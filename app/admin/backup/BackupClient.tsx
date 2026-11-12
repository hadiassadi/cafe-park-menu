'use client'

import { useEffect, useRef, useState } from 'react'
import { BACKUP_SECTIONS, STORAGE_SECTION_KEY, STORAGE_SECTION_LABEL } from '@/lib/backup-sections'

type StorageFile = { name: string; data: string }

type BackupMeta = {
  app?: string
  backupVersion?: number
  createdAt?: string
  counts?: Record<string, number>
  skipped?: Record<string, string>
  storageCounts?: Record<string, number>
  tables?: Record<string, unknown[]>
  storage?: Record<string, StorageFile[]>
  storageSkipped?: Record<string, string>
}

// نسخه‌های پشتیبانی‌شده: ۱ = فقط جداول، ۲ = جداول + فایل‌های Storage
const BACKUP_VERSION_OK = (v?: number) => v === 1 || v === 2

type SectionStatus = 'pending' | 'active' | 'done' | 'error'
type BackupItem = {
  key: string
  label: string
  status: SectionStatus
  rows?: number
  files?: number
  error?: string
}
type LastBackup = { at: string; rows: number; files: number; size: number; ok: boolean }

type RestoreProgress = { table: string; done: number; total: number }
type RestoreReport = { table: string; upserted: number; error?: string }

const HISTORY_KEY = 'cafepark_backup_history'
const RESTORE_WORD = 'بازگردانی'
const CLIENT_CHUNK = 500 // زیر سقف 4.5MB بدنه‌ی درخواست Vercel
const SECTION_TIMEOUT_MS = 90_000

function initialItems(): BackupItem[] {
  return [
    ...BACKUP_SECTIONS.map((s) => ({ key: s.key, label: s.label, status: 'pending' as SectionStatus })),
    { key: STORAGE_SECTION_KEY, label: STORAGE_SECTION_LABEL, status: 'pending' as SectionStatus },
  ]
}

function fa(n: number): string {
  return n.toLocaleString('fa-IR')
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} مگابایت`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} کیلوبایت`
  return `${fa(bytes)} بایت`
}

function loadHistory(): LastBackup[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveHistory(list: LastBackup[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 5)))
  } catch {
    // حافظهٔ مرورگر در دسترس نیست — تاریخچه اختیاری است
  }
}

export default function BackupClient() {
  // ─── بکاپ ───
  const [modalOpen, setModalOpen] = useState(false)
  const [items, setItems] = useState<BackupItem[]>(initialItems)
  const [running, setRunning] = useState(false)
  const [overall, setOverall] = useState({ done: 0, total: initialItems().length })
  const [finalError, setFinalError] = useState<string | null>(null)
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState<string | null>(null)
  const [lastBackup, setLastBackup] = useState<LastBackup | null>(null)
  const [history, setHistory] = useState<LastBackup[]>([])

  const payloadRef = useRef<{
    tables: Record<string, unknown[]>
    skipped: Record<string, string>
    storage: Record<string, StorageFile[]>
    storageSkipped: Record<string, string>
  } | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  // وضعیت خطای هر بخش در ref نگه‌داری می‌شود تا ارزیابی پایان به state کهنه‌ی closure تکیه نکند
  const errorsRef = useRef<Set<string>>(new Set())

  // ─── بازگردانی ───
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<BackupMeta | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)
  const [report, setReport] = useState<RestoreReport[] | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  useEffect(() => {
    const h = loadHistory()
    setHistory(h)
    setLastBackup(h[0] ?? null)
  }, [])

  // قفل اسکرول صفحه در حین بکاپ
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [modalOpen])

  const totalRows = (meta: BackupMeta | null) =>
    meta?.counts ? Object.values(meta.counts).reduce((a, b) => a + b, 0) : 0

  const totalStorageFiles = (meta: BackupMeta | null) =>
    meta?.storage ? Object.values(meta.storage).reduce((a, b) => a + b.length, 0) : 0

  const revokeResult = () => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResultBlobUrl(null)
    setResultName(null)
  }

  // ───────────────── اجرای یک بخش بکاپ ─────────────────
  const runSection = async (key: string): Promise<boolean> => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'active', error: undefined } : it)))
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), SECTION_TIMEOUT_MS)
      const res = await fetch(`/api/admin/backup?section=${encodeURIComponent(key)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timer)
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || `خطای سرور (${res.status})`)
      }

      const p = payloadRef.current
      if (!p) throw new Error('وضعیت بکاپ از دست رفت')

      errorsRef.current.delete(key)

      if (key === STORAGE_SECTION_KEY) {
        p.storage = j.storage ?? {}
        p.storageSkipped = j.storageSkipped ?? {}
        setItems((prev) =>
          prev.map((it) =>
            it.key === key ? { ...it, status: 'done', files: j.files ?? 0 } : it
          )
        )
      } else {
        Object.assign(p.tables, j.tables ?? {})
        Object.assign(p.skipped, j.skipped ?? {})
        setItems((prev) =>
          prev.map((it) =>
            it.key === key ? { ...it, status: 'done', rows: j.rows ?? 0 } : it
          )
        )
      }
      return true
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'AbortError'
          ? 'زمان انتظار تمام شد'
          : e instanceof Error
            ? e.message
            : 'خطای نامشخص'
      errorsRef.current.add(key)
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'error', error: msg } : it)))
      return false
    }
  }

  const evaluateAndFinish = () => {
    const p = payloadRef.current
    if (!p) return
    const failedKeys = [...errorsRef.current]
    if (failedKeys.length === 0) {
      setFinalError(null)
    } else {
      const labels = failedKeys.map(
        (k) => initialItems().find((it) => it.key === k)?.label ?? k
      )
      setFinalError(
        `${fa(failedKeys.length)} بخش کامل نشد${
          failedKeys.length === 1 ? ` — ${labels[0]}` : `: ${labels.join('، ')}`
        }؛ می‌توانید فقط همان بخش‌ها را دوباره تلاش کنید.`
      )
    }
    buildAndDownload(failedKeys.length === 0)
  }

  const runBackup = async () => {
    setRunning(true)
    setFinalError(null)
    revokeResult()
    errorsRef.current = new Set()
    payloadRef.current = { tables: {}, skipped: {}, storage: {}, storageSkipped: {} }
    const seq = [...BACKUP_SECTIONS.map((s) => s.key), STORAGE_SECTION_KEY]
    setItems(initialItems())
    for (let i = 0; i < seq.length; i++) {
      setOverall({ done: i, total: seq.length })
      await runSection(seq[i])
      setOverall({ done: i + 1, total: seq.length })
    }
    setRunning(false)
    evaluateAndFinish()
  }

  const retrySection = async (key: string) => {
    setRunning(true)
    await runSection(key)
    setRunning(false)
    evaluateAndFinish()
  }

  const buildAndDownload = (isComplete: boolean) => {
    const p = payloadRef.current
    if (!p) return
    const counts = Object.fromEntries(
      Object.entries(p.tables).map(([k, v]) => [k, (v as unknown[]).length])
    )
    const storageCounts = Object.fromEntries(
      Object.entries(p.storage).map(([k, v]) => [k, v.length])
    )
    const payload: BackupMeta = {
      app: 'cafe-park-menu',
      backupVersion: 2,
      createdAt: new Date().toISOString(),
      counts,
      skipped: p.skipped,
      storageCounts,
      storageSkipped: p.storageSkipped,
      tables: p.tables,
      storage: p.storage,
    }
    const text = JSON.stringify(payload)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    resultUrlRef.current = url
    setResultBlobUrl(url)
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    const name = `${isComplete ? 'cafepark-backup' : 'cafepark-backup-INCOMPLETE'}-${stamp}.json`
    setResultName(name)
    downloadUrl(url, name)

    const rows = Object.values(counts).reduce((a, b) => a + b, 0)
    const files = Object.values(storageCounts).reduce((a, b) => a + b, 0)
    const entry: LastBackup = { at: payload.createdAt!, rows, files, size: blob.size, ok: isComplete }
    const hist = [entry, ...loadHistory()].slice(0, 5)
    saveHistory(hist)
    setHistory(hist)
    setLastBackup(entry)
  }

  const downloadUrl = (url: string, name: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
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

  // ───────────────── بازگردانی (منطق قبلی، حفظ‌شده) ─────────────────
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
            throw new Error(`جدول «${table}»: ${j?.error || `خطای سرور (${res.status})`}`)
          }
          reportAcc.push({ table, upserted: j.upserted ?? 0 })
        }
      }

      // ─── بازگردانی فایل‌های Storage (چانک بر اساس حجم) ───
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

  const doneCount = items.filter((it) => it.status === 'done').length
  const totalBackupRows = lastBackup?.rows ?? 0

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>💾 پشتیبان‌گیری</h1>
          <p className="admin-subtitle">
            بکاپ شامل داده‌های دیتابیس به‌علاوه‌ی فایل‌های Storage (تصاویر محصولات، رسیدها، فونت‌ها) است؛ فایل را در جای امن نگه دارید.
          </p>
        </div>
        <button
          className="btn primary-btn"
          onClick={() => { setModalOpen(true); runBackup() }}
        >
          🛡️ شروع پشتیبان‌گیری
        </button>
      </div>

      {/* آخرین بکاپ */}
      <div className="admin-card backup-hero">
        {lastBackup ? (
          <>
            <div className="backup-hero-title">
              {lastBackup.ok ? '✅ آخرین پشتیبان‌گیری' : '⚠️ آخرین پشتیبان‌گیری (ناقص)'}
            </div>
            <div className="backup-hero-meta">
              {faDateTime(lastBackup.at)} — {fa(totalBackupRows)} ردیف
              {lastBackup.files > 0 && ` + ${fa(lastBackup.files)} فایل`} ({formatSize(lastBackup.size)})
            </div>
            <div className="backup-hero-note">
              تاریخچه روی این دستگاه ذخیره می‌شود؛ خود فایل بکاپ جایی ذخیره نمی‌شود مگر اینکه شما دانلود و نگه‌داری کنید.
            </div>
          </>
        ) : (
          <>
            <div className="backup-hero-title">هنوز بکاپی گرفته نشده</div>
            <div className="backup-hero-meta">برای شروع، دکمه‌ی «شروع پشتیبان‌گیری» را بزنید.</div>
          </>
        )}
      </div>

      {/* تاریخچه */}
      {history.length > 1 && (
        <div className="admin-card">
          <div className="backup-history-title">تاریخچه‌ی بکاپ‌ها (۵ مورد اخیر روی این دستگاه)</div>
          <div className="backup-history-list">
            {history.map((h) => (
              <div key={h.at} className="backup-history-row">
                <span>{h.ok ? '✅' : '⚠️'} {faDateTime(h.at)}</span>
                <span>
                  {fa(h.rows)} ردیف{h.files > 0 && ` + ${fa(h.files)} فایل`} — {formatSize(h.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* بازگردانی */}
      <div className="admin-card">
        <h2 className="backup-section-title">♻️ بازگردانی از فایل بکاپ</h2>
        <p className="backup-muted">
          ردیف‌های فایل بکاپ روی دیتابیس فعلی <b>upsert</b> می‌شوند: ردیف‌های موجود با نسخه‌ی بکاپ جایگزین و بقیه اضافه می‌شوند. هیچ داده‌ای حذف نمی‌شود.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="backup-file-input"
        />

        {fileName && <div className="backup-muted">فایل انتخاب‌شده: {fileName}</div>}

        {parsed && (
          <div className="backup-parsed-box">
            <div className="backup-history-title">
              تاریخ بکاپ: {parsed.createdAt ? faDateTime(parsed.createdAt) : '—'}
            </div>
            <div>
              مجموع {fa(totalRows(parsed))} ردیف از {fa(parsed.tables ? Object.keys(parsed.tables).length : 0)} جدول
              {totalStorageFiles(parsed) > 0 && ` + ${fa(totalStorageFiles(parsed))} فایل Storage`}
            </div>
          </div>
        )}

        {parsed && (
          <>
            <label className="backup-confirm-label">
              برای تأیید، عبارت «{RESTORE_WORD}» را تایپ کنید:
            </label>
            <input
              className="backup-confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={RESTORE_WORD}
              disabled={restoring}
            />
            <button className="btn danger" onClick={handleRestore} disabled={restoring || confirmText !== RESTORE_WORD}>
              {restoring ? 'در حال بازگردانی…' : '♻️ شروع بازگردانی'}
            </button>
          </>
        )}

        {progress && (
          <div className="backup-muted">
            در حال بازگردانی «{progress.table}»: {fa(progress.done)} از {fa(progress.total)} ردیف…
          </div>
        )}

        {restoreError && <div className="backup-error-line">خطا: {restoreError}</div>}

        {report && report.length > 0 && (
          <div className="backup-report-box">
            {report.map((r) => (
              <div key={r.table}>
                {r.error ? '❌' : '✅'} <b>{r.table}</b>: {fa(r.upserted)} ردیف
                {r.error ? ` — ${r.error}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── مودال پشتیبان‌گیری ─── */}
      {modalOpen && (
        <div className="backup-overlay">
          <div className="backup-modal" role="dialog" aria-modal="true" aria-label="پشتیبان‌گیری">
            <div className="backup-modal-head">
              <div className="backup-modal-title">
                {running ? 'در حال پشتیبان‌گیری…' : resultBlobUrl ? 'پشتیبان‌گیری تمام شد' : 'پشتیبان‌گیری'}
              </div>
              <button
                className="backup-close"
                onClick={() => { setModalOpen(false); revokeResult() }}
                disabled={running}
                aria-label="بستن"
              >
                ✕
              </button>
            </div>

            <div className="backup-banner">
              🔒 در طول پشتیبان‌گیری امکان کار با بخش‌های دیگر منو وجود ندارد؛ تا پایان این صفحه باز می‌ماند.
            </div>

            <div className="backup-progress-line">
              بخش {fa(overall.done)} از {fa(overall.total)}
            </div>
            <div className="backup-progress">
              <div className="backup-progress-fill" style={{ width: `${Math.round((overall.done / overall.total) * 100)}%` }} />
            </div>

            {!running && (
              <div className="backup-restart-row">
                <button className="backup-retry" onClick={runBackup}>
                  ↺ شروع دوباره از ابتدا
                </button>
              </div>
            )}

            <div className="backup-check">
              {items.map((it) => (
                <div key={it.key} className={`backup-item is-${it.status}`}>
                  <span className="backup-item-icon">
                    {it.status === 'done' ? '✅' : it.status === 'error' ? '❌' : it.status === 'active' ? <span className="backup-spinner" aria-label="در حال اجرا" /> : '⏳'}
                  </span>
                  <span className="backup-item-body">
                    <span className="backup-item-label">
                      {it.label}
                      {it.status === 'done' && it.rows !== undefined && (
                        <span className="backup-item-meta"> — {fa(it.rows)} ردیف</span>
                      )}
                      {it.status === 'done' && it.files !== undefined && (
                        <span className="backup-item-meta"> — {fa(it.files)} فایل</span>
                      )}
                    </span>
                    {it.status === 'error' && (
                      <span className="backup-item-error">
                        {it.error}
                        <button className="backup-retry" onClick={() => retrySection(it.key)} disabled={running}>
                          ↻ تلاش مجدد
                        </button>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {doneCount === items.length && (
              <div className="backup-summary">
                <b>✅ بکاپ کامل گرفته شد.</b>
                <div className="backup-muted">
                  فایل به‌صورت خودکار دانلود شد؛ اگر دانلود نشد از دکمه‌ی زیر استفاده کنید.
                </div>
                {resultBlobUrl && resultName && (
                  <button className="btn primary-btn backup-download-btn" onClick={() => downloadUrl(resultBlobUrl, resultName!)}>
                    ⬇️ دانلود فایل بکاپ ({resultName})
                  </button>
                )}
              </div>
            )}

            {finalError && (
              <div className="backup-summary is-partial">
                <b>⚠️ بکاپ ناقص است.</b>
                <div className="backup-muted">{finalError}</div>
                {resultBlobUrl && resultName && (
                  <button className="btn backup-download-btn" onClick={() => downloadUrl(resultBlobUrl, resultName!)}>
                    ⬇️ دانلود فایل ناقص ({resultName})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function faDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fa-IR')
}
