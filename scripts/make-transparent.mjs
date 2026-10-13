#!/usr/bin/env node
/**
 * حذف پس‌زمینه از آیکون‌ها (Flood-Fill هوشمند)
 * - پس‌زمینه سفید یا مشکی رو حذف می‌کنه
 * - لبه‌ها رو با anti-aliasing نرم می‌کنه
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ICONS_DIR = path.join(ROOT, 'public', 'icons')

// تلورانس برای پیکسل‌های داخلی
const TOLERANCE = 45
// تلورانس بیشتر برای لبه‌ها (anti-alias)
const EDGE_TOLERANCE = 100

async function makeTransparent(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  رد شد (نیست): ${path.basename(filePath)}`)
    return
  }

  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.ico') {
    console.log(`⏭️  رد شد (ICO): ${path.basename(filePath)}`)
    return
  }

  // خوندن تصویر با آلفا
  const { data: originalData, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const data = new Uint8ClampedArray(originalData)

  // رنگ مرجع از گوشه
  const refR = data[0]
  const refG = data[1]
  const refB = data[2]
  console.log(
    `   📐 ${width}×${height} | 🎨 رنگ گوشه: rgb(${refR}, ${refG}, ${refB})`
  )

  // Flood-fill از گوشه‌ها
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let queueStart = 0
  let queueEnd = 0

  function enqueue(idx) {
    if (visited[idx]) return
    if (queueEnd >= queue.length) return
    queue[queueEnd++] = idx
  }

  // شروع از ۴ گوشه
  enqueue(0)
  enqueue(width - 1)
  enqueue((height - 1) * width)
  enqueue(width * height - 1)

  let transparentCount = 0
  let edgeCount = 0

  while (queueStart < queueEnd) {
    const idx = queue[queueStart++]
    if (visited[idx]) continue
    visited[idx] = 1

    const x = idx % width
    const y = Math.floor(idx / width)
    const i = idx * channels

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const diff = Math.abs(r - refR) + Math.abs(g - refG) + Math.abs(b - refB)

    // پیکسل خارج از تلورانس → مرز، متوقف شو
    if (diff > EDGE_TOLERANCE) continue

    // محاسبه شدت شفافیت
    let alpha = 0
    if (diff > TOLERANCE) {
      // پیکسل لبه → نیمه‌شفاف (anti-aliasing)
      const ratio = (diff - TOLERANCE) / (EDGE_TOLERANCE - TOLERANCE)
      alpha = Math.round(255 * ratio)
      edgeCount++
    } else {
      // پیکسل پس‌زمینه کامل → کاملاً شفاف
      transparentCount++
    }

    data[i + 3] = alpha

    // اضافه کردن همسایه‌ها
    if (x > 0) enqueue(idx - 1)
    if (x < width - 1) enqueue(idx + 1)
    if (y > 0) enqueue(idx - width)
    if (y < height - 1) enqueue(idx + width)
  }

  console.log(
    `   ✅ ${transparentCount.toLocaleString('fa-IR')} پیکسل شفاف + ${edgeCount.toLocaleString('fa-IR')} پیکسل لبه نرم`
  )

  // ذخیره
  await sharp(Buffer.from(data.buffer), {
    raw: { width, height, channels },
  })
    .png({ compressionLevel: 9 })
    .toFile(filePath)
}

async function main() {
  console.log('🎨 حذف پس‌زمینه از آیکون‌ها\n')

  // مسیر جدید: source-logo.png رو هم پردازش کن
  const files = [
    path.join(ICONS_DIR, 'source-logo.png'), // ✅ فایل منبع
    path.join(ICONS_DIR, 'icon-192.png'),
    path.join(ICONS_DIR, 'android-chrome-512x512.png'),
    path.join(ICONS_DIR, 'apple-touch-icon.png'),
    path.join(ICONS_DIR, 'favicon-16x16.png'),
    path.join(ICONS_DIR, 'favicon-32x32.png'),
  ]

  for (const file of files) {
    console.log(`\n📄 ${path.basename(file)}`)
    await makeTransparent(file)
  }

  console.log('\n\n🎉 تمام شد!')
}

main().catch((err) => {
  console.error('❌ خطا:', err)
  process.exit(1)
})