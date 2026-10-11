#!/usr/bin/env node
/**
 * اسکریپت بکاپ خودکار پروژه کافه پارک
 * 
 * استفاده:
 *   node scripts/backup.mjs            ← بکاپ کامل (فایل + zip)
 *   node scripts/backup.mjs --files    ← فقط کپی فایل‌ها (بدون zip)
 *   node scripts/backup.mjs --clean    ← حذف بکاپ‌های قدیمی (بیشتر از 30 روز)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BACKUP_DIR = path.join(ROOT, 'backups')

// پوشه‌هایی که باید نادیده گرفته شوند
const IGNORE = new Set([
  'node_modules',
  '.next',
  '.git',
  '.vercel',
  'backups',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
])

// پسوندهایی که کپی می‌شوند
const KEEP_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass',
  '.json', '.md', '.sql',
  '.env', '.env.local', '.env.example',
  '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.otf',
])

// فایل‌های مهم که حتی بدون پسوند نگه داشته می‌شوند
const KEEP_FILENAMES = new Set([
  'middleware.ts',
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'README.md',
  'PROJECT_STATE.md',
  '.env.local',
  '.env.example',
  'schema.sql',
])

// فرمت تاریخ شمسی ساده (YYYY-MM-DD)
function getDateStamp() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return { date: `${y}-${m}-${d}`, time: `${y}-${m}-${d}_${hh}-${mm}` }
}

// کپی بازگشتی فایل‌ها با فیلتر
function copyRecursive(src, dest) {
  const stats = fs.statSync(src)
  const basename = path.basename(src)

  if (stats.isDirectory()) {
    if (IGNORE.has(basename)) return
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
    return
  }

  // اگر فایل مهم است، کپی کن
  const ext = path.extname(src).toLowerCase()
  if (KEEP_EXTENSIONS.has(ext) || KEEP_FILENAMES.has(basename)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

// پاک کردن بکاپ‌های قدیمی (بیشتر از days روز)
function cleanOldBackups(days = 30) {
  if (!fs.existsSync(BACKUP_DIR)) return
  const now = Date.now()
  const maxAge = days * 24 * 60 * 60 * 1000

  for (const entry of fs.readdirSync(BACKUP_DIR)) {
    const fullPath = path.join(BACKUP_DIR, entry)
    const stats = fs.statSync(fullPath)
    if (now - stats.mtimeMs > maxAge) {
      fs.rmSync(fullPath, { recursive: true, force: true })
      console.log(`🗑️  حذف بکاپ قدیمی: ${entry}`)
    }
  }
}

// ساخت zip از پوشه بکاپ
function createZip(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      const size = (archive.pointer() / 1024 / 1024).toFixed(2)
      console.log(`📦 zip ساخته شد: ${path.basename(zipPath)} (${size} MB)`)
      resolve()
    })

    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

async function main() {
  const args = process.argv.slice(2)
  const onlyFiles = args.includes('--files')
  const doClean = args.includes('--clean')

  console.log('🔄 شروع بکاپ‌گیری...\n')

  // پاکسازی بکاپ‌های قدیمی
  if (doClean) {
    cleanOldBackups(30)
    console.log('')
  }

  const { date, time } = getDateStamp()
  const dayDir = path.join(BACKUP_DIR, date)
  const snapshotDir = path.join(dayDir, `snapshot_${time}`)

  fs.mkdirSync(snapshotDir, { recursive: true })

  // کپی فایل‌ها
  console.log(`📁 کپی فایل‌ها به: backups/${date}/snapshot_${time}/`)
  copyRecursive(ROOT, snapshotDir)

  // آمار
  let fileCount = 0
  let totalSize = 0
  function countFiles(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      const st = fs.statSync(full)
      if (st.isDirectory()) countFiles(full)
      else {
        fileCount++
        totalSize += st.size
      }
    }
  }
  countFiles(snapshotDir)

  console.log(`✅ ${fileCount} فایل کپی شد (${(totalSize / 1024).toFixed(1)} KB)\n`)

  // ساخت zip
  if (!onlyFiles) {
    const zipPath = path.join(dayDir, `cafe-park_${time}.zip`)
    await createZip(snapshotDir, zipPath)

    // حذف پوشه snapshot (چون zip گرفته شده)
    fs.rmSync(snapshotDir, { recursive: true, force: true })
    console.log(`\n✅ پوشه snapshot حذف شد (فقط zip نگه داشته شد)`)
  }

  console.log(`\n🎉 بکاپ کامل شد: backups/${date}/`)
  console.log(`   زمان: ${new Date().toLocaleString('fa-IR')}\n`)
}

main().catch((err) => {
  console.error('❌ خطا در بکاپ:', err)
  process.exit(1)
})