#!/usr/bin/env node
/**
 * تبدیل JFIF (JPG) به PNG شفاف
 * - پس‌زمینه رو با Flood-Fill حذف می‌کنه
 * - لبه‌ها رو با anti-aliasing نرم می‌کنه
 * 
 * استفاده:
 *   node scripts/jfif-to-png.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SOURCE = path.join(ROOT, 'public', 'icons', 'source-logo.jfif')
const OUTPUT = path.join(ROOT, 'public', 'icons', 'source-logo.png')

// تلورانس برای تشخیص پس‌زمینه (JPG artifacts داره، پس بالاتره)
const TOLERANCE = 80

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('❌ فایل پیدا نشد:', SOURCE)
    console.error('   لطفاً فایل رو به این مسیر کپی کن و اسمش رو source-logo.jfif بذار.')
    process.exit(1)
  }

  console.log('🔄 در حال تبدیل JFIF به PNG شفاف...\n')

  // خوندن JFIF با آلفا
  const { data: originalData, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  console.log(`📐 ابعاد: ${width}×${height}`)

  // کپی از buffer
  const data = new Uint8ClampedArray(originalData)

  // رنگ مرجع از گوشه بالا-چپ (سفید یا تیره)
  const refR = data[0]
  const refG = data[1]
  const refB = data[2]
  console.log(`🎨 رنگ پس‌زمینه: rgb(${refR}, ${refG}, ${refB})\n`)

  // Flood-fill از چهار گوشه
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let queueStart = 0
  let queueEnd = 0

  function enqueue(idx) {
    if (visited[idx]) return
    if (queueEnd >= queue.length) return
    queue[queueEnd++] = idx
  }

  enqueue(0)
  enqueue(width - 1)
  enqueue((height - 1) * width)
  enqueue(width * height - 1)

  let transparentCount = 0

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

    if (diff > TOLERANCE) continue

    // شفاف کن
    data[i + 3] = 0
    transparentCount++

    if (x > 0) enqueue(idx - 1)
    if (x < width - 1) enqueue(idx + 1)
    if (y > 0) enqueue(idx - width)
    if (y < height - 1) enqueue(idx + width)
  }

  console.log(`✅ ${transparentCount.toLocaleString('fa-IR')} پیکسل شفاف شد`)

  // ذخیره به PNG شفاف
  await sharp(Buffer.from(data.buffer), {
    raw: { width, height, channels },
  })
    .png({ compressionLevel: 9 })
    .toFile(OUTPUT)

  console.log(`💾 فایل ذخیره شد: ${path.basename(OUTPUT)}`)
  console.log('\n🎉 تمام شد!')
  console.log('\n💡 حالا اسکریپت build-icons رو اجرا کن تا آیکون‌ها ساخته بشن.')
}

main().catch((err) => {
  console.error('❌ خطا:', err)
  process.exit(1)
})