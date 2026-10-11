#!/usr/bin/env node
/**
 * اسکریپت بکاپ کامل سرور — کافه پارک
 * 
 * استفاده:
 *   node scripts/backup-server.mjs              ← بکاپ کامل
 *   node scripts/backup-server.mjs --no-deps    ← بدون node_modules
 *   node scripts/backup-server.mjs --clean      ← فقط حذف بکاپ‌های قدیمی
 *   node scripts/backup-server.mjs --dry-run    ← فقط شمارش فایل‌ها
 *   node scripts/backup-server.mjs --include-build ← شامل .next
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BACKUP_DIR = path.join(ROOT, 'backups-server')

// ─── تنظیمات ───────────────────────────────────────────
const INCLUDE_NODE_MODULES = !process.argv.includes('--no-deps')
const INCLUDE_NEXT_BUILD = process.argv.includes('--include-build')
const MAX_BACKUP_AGE_DAYS = 14

// پوشه‌هایی که کاملاً نادیده گرفته می‌شوند
const IGNORE_DIRS = new Set([
  '.git',
  '.vercel',
  '.turbo',
  '.cache',
  '.swc',
  '.eslintcache',
  '.npm',
  '.yarn',
  'backups',
  'backups-server',
  'coverage',
  'dist',
  'out',
])

if (!INCLUDE_NEXT_BUILD) {
  IGNORE_DIRS.add('.next')
}

// فایل‌هایی که نادیده گرفته می‌شوند
const IGNORE_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
])

// ─── توابع کمکی ─────────────────────────────────────────

function getDateStamp() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return { date: `${y}-${m}-${d}`, time: `${y}-${m}-${d}_${hh}-${mm}` }
}

function shouldIgnore(name) {
  if (IGNORE_FILES.has(name)) return true
  return false
}

// کپی بازگشتی با فیلتر + گزارش پیشرفت
function copyRecursive(src, dest, stats = { files: 0, size: 0 }) {
  const base = path.basename(src)

  if (IGNORE_DIRS.has(base) || shouldIgnore(base)) return stats

  const st = fs.statSync(src)

  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry), stats)
    }
    return stats
  }

  // کپی فایل
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  stats.files++
  stats.size += st.size

  // گزارش پیشرفت هر ۲۰۰۰ فایل
  if (stats.files % 2000 === 0) {
    console.log(`   ⏳ ${stats.files.toLocaleString('fa-IR')} فایل کپی شد...`)
  }

  return stats
}

function cleanOldBackups(days = MAX_BACKUP_AGE_DAYS) {
  if (!fs.existsSync(BACKUP_DIR)) return
  const now = Date.now()
  const maxAge = days * 24 * 60 * 60 * 1000
  let cleaned = 0

  for (const entry of fs.readdirSync(BACKUP_DIR)) {
    const fullPath = path.join(BACKUP_DIR, entry)
    const stats = fs.statSync(fullPath)
    if (now - stats.mtimeMs > maxAge) {
      fs.rmSync(fullPath, { recursive: true, force: true })
      console.log(`🗑️  حذف بکاپ قدیمی: ${entry}`)
      cleaned++
    }
  }
  if (cleaned === 0) console.log('✨ بکاپ قدیمی‌ای برای حذف وجود ندارد.')
}

function createZip(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => resolve())
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// ─── اجرای اصلی ─────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const doClean = args.includes('--clean')
  const dryRun = args.includes('--dry-run')

  if (doClean) {
    console.log(`🗑️  پاکسازی بکاپ‌های سرور قدیمی‌تر از ${MAX_BACKUP_AGE_DAYS} روز...\n`)
    cleanOldBackups()
    console.log('\n✅ پاکسازی کامل شد.')
    return
  }

  console.log('═'.repeat(60))
  console.log('  🖥️   بکاپ کامل سرور — کافه پارک')
  console.log('═'.repeat(60))
  console.log()
  console.log(`  📂 منبع:          ${ROOT}`)
  console.log(`  💾 مقصد:          backups-server/`)
  console.log(`  📦 node_modules:  ${INCLUDE_NODE_MODULES ? '✅ شامل' : '❌ حذف'}`)
  console.log(`  🏗️  .next/build:   ${INCLUDE_NEXT_BUILD ? '✅ شامل' : '❌ حذف'}`)
  console.log(`  🧪 حالت تست:      ${dryRun ? '✅ فعال' : 'خیر'}`)
  console.log()

  const { date, time } = getDateStamp()
  const dayDir = path.join(BACKUP_DIR, date)
  const snapshotDir = path.join(dayDir, `snapshot_${time}`)

  fs.mkdirSync(snapshotDir, { recursive: true })

  console.log(`📁 شروع کپی فایل‌ها...`)
  const startTime = Date.now()
  const stats = copyRecursive(ROOT, snapshotDir)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log()
  console.log(`  ✅ ${stats.files.toLocaleString('fa-IR')} فایل کپی شد`)
  console.log(`  📊 حجم کل: ${formatSize(stats.size)}`)
  console.log(`  ⏱️  زمان: ${elapsed} ثانیه`)
  console.log()

  if (dryRun) {
    fs.rmSync(snapshotDir, { recursive: true, force: true })
    console.log('✅ حالت تست کامل شد (فایل‌ها حذف شدند).')
    return
  }

  const zipName = `cafe-park-server_${time}.zip`
  const zipPath = path.join(dayDir, zipName)
  console.log(`📦 در حال ساخت zip: ${zipName}...`)
  await createZip(snapshotDir, zipPath)

  fs.rmSync(snapshotDir, { recursive: true, force: true })

  const zipSize = fs.statSync(zipPath).size
  console.log()
  console.log('═'.repeat(60))
  console.log('  ✅ بکاپ سرور با موفقیت ساخته شد!')
  console.log('═'.repeat(60))
  console.log(`  📦 نام فایل: backups-server/${date}/${zipName}`)
  console.log(`  📊 حجم zip:  ${formatSize(zipSize)}`)
  console.log(`  📁 تعداد فایل: ${stats.files.toLocaleString('fa-IR')}`)
  console.log(`  🕐 زمان:     ${new Date().toLocaleString('fa-IR')}`)
  console.log()
  console.log(`💡 برای پاکسازی بکاپ‌های قدیمی‌تر از ${MAX_BACKUP_AGE_DAYS} روز:`)
  console.log(`   npm run backup:server:clean`)
  console.log()
}

main().catch((err) => {
  console.error('❌ خطا در بکاپ سرور:', err)
  process.exit(1)
})