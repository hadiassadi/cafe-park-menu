#!/usr/bin/env node
/**
 * ساخت همه آیکون‌های PWA از یه فایل PNG شفاف
 * 
 * استفاده:
 *   npm run build:icons
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ICONS_DIR = path.join(ROOT, 'public', 'icons')
const SOURCE = path.join(ICONS_DIR, 'source-logo.png')

// ─── اندازه‌های مورد نیاز ───
const ICONS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
]

// ─── ساخت maskable با پس‌زمینه قهوه‌ای ───
// برای Android که آیکون رو در شکل‌های مختلف نمایش می‌ده
const MASKABLE_BG = { r: 30, g: 58, b: 42, alpha: 1 } // سبز تیره کافه پارک

async function buildIcon(name, size, withBackground = false) {
  const outputPath = path.join(ICONS_DIR, name)

  if (withBackground) {
    // پس‌زمینه رنگی + لوگو در وسط
    const padding = Math.round(size * 0.1) // ۱۰٪ حاشیه امن
    const innerSize = size - padding * 2

    const resizedLogo = await sharp(SOURCE)
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer()

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: MASKABLE_BG,
      },
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(outputPath)
  } else {
    // فقط resize با حفظ شفافیت
    await sharp(SOURCE)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(outputPath)
  }

  const stats = fs.statSync(outputPath)
  const kb = (stats.size / 1024).toFixed(1)
  console.log(
    `   ✅ ${name.padEnd(30)} (${size}×${size}) — ${kb} KB${withBackground ? ' [maskable]' : ''}`
  )
}

async function main() {
  console.log('🎨 ساخت آیکون‌ها از فایل شفاف...\n')

  // چک فایل منبع
  if (!fs.existsSync(SOURCE)) {
    console.error('❌ فایل منبع پیدا نشد:')
    console.error(`   ${SOURCE}`)
    console.error('   لطفاً فایل PNG شفاف رو به اسم source-logo.png در public/icons بذار.')
    process.exit(1)
  }

  const meta = await sharp(SOURCE).metadata()
  console.log(`📐 فایل منبع: ${meta.width}×${meta.height} — ${meta.format}\n`)
  console.log('📦 در حال ساخت آیکون‌ها:')

  // آیکون‌های عادی
  for (const icon of ICONS) {
    await buildIcon(icon.name, icon.size, false)
  }

  // آیکون maskable (برای Android)
  console.log('\n📱 آیکون maskable (Android):')
  await buildIcon('icon-maskable-192.png', 192, true)
  await buildIcon('icon-maskable-512.png', 512, true)

  console.log('\n🎉 همه آیکون‌ها با موفقیت ساخته شدند!')
  console.log(`📍 مسیر: public/icons/\n`)
}

main().catch((err) => {
  console.error('❌ خطا:', err)
  process.exit(1)
})