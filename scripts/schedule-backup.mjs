#!/usr/bin/env node
/**
 * اجرای بکاپ خودکار در فواصل منظم (پیش‌فرض: هر 24 ساعت)
 * 
 * این اسکریپت را در یک ترمینال جداگانه اجرا کن:
 *   npm run backup:schedule
 * 
 * و بگذار باز بماند. هر 24 ساعت یک‌بار بکاپ می‌گیرد.
 * برای متوقف کردن: Ctrl + C
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_SCRIPT = path.join(__dirname, 'backup.mjs')

// فاصله بکاپ (پیش‌فرض 24 ساعت = 86400000 میلی‌ثانیه)
const INTERVAL = 24 * 60 * 60 * 1000

function runBackup() {
  console.log('\n' + '═'.repeat(50))
  console.log(`⏰ شروع بکاپ زمان‌بندی‌شده: ${new Date().toLocaleString('fa-IR')}`)
  console.log('═'.repeat(50))

  const child = spawn('node', [BACKUP_SCRIPT], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  })

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ بکاپ با موفقیت انجام شد.')
    } else {
      console.error(`❌ بکاپ با خطا مواجه شد (کد ${code})`)
    }
  })
}

// بکاپ فوری در شروع
runBackup()

// بکاپ دوره‌ای
setInterval(runBackup, INTERVAL)

console.log(`\n🚀 زمان‌بند بکاپ فعال شد. هر ${INTERVAL / 1000 / 3600} ساعت یک‌بار بکاپ می‌گیرد.`)
console.log('   برای متوقف کردن: Ctrl + C\n')