import sharp from 'sharp'
import { readdirSync, statSync, renameSync, rmSync, cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const dir = 'public/icons'
const keep = new Set([
  'favicon-16x16.png',
  'favicon-32x32.png',
  'icon-192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
])

const junkDir = join(tmpdir(), 'icons-junk-' + Date.now())
mkdirSync(junkDir, { recursive: true })

for (const f of readdirSync(dir, { withFileTypes: true })) {
  const p = join(dir, f.name)
  if (!keep.has(f.name)) {
    cpSync(p, join(junkDir, f.name), { recursive: true })
    rmSync(p, { recursive: true })
    console.log('جunk منتقل شد به Temp:', f.name)
    continue
  }
  const before = statSync(p).size
  await sharp(p).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(p + '.tmp')
  renameSync(p + '.tmp', p)
  const after = statSync(p).size
  console.log(`${f.name}: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB`)
}
console.log('پوشهی انتقالی موقت:', junkDir)
