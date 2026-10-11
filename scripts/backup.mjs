async function main() {
  const args = process.argv.slice(2)
  const onlyFiles = args.includes('--files')
  const doClean = args.includes('--clean')

  // ✅ اگه فقط --clean بود، فقط پاکسازی کن و تمام
  if (doClean && !onlyFiles) {
    console.log('🗑️  پاکسازی بکاپ‌های قدیمی (بیشتر از ۳۰ روز)...\n')
    cleanOldBackups(30)
    console.log('\n✅ پاکسازی کامل شد.')
    return
  }

  // در غیر این صورت، بکاپ بگیر
  console.log('🔄 شروع بکاپ‌گیری...\n')

  const { date, time } = getDateStamp()
  const dayDir = path.join(BACKUP_DIR, date)
  const snapshotDir = path.join(dayDir, `snapshot_${time}`)

  fs.mkdirSync(snapshotDir, { recursive: true })

  console.log(`📁 کپی فایل‌ها به: backups/${date}/snapshot_${time}/`)
  copyRecursive(ROOT, snapshotDir)

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

  if (!onlyFiles) {
    const zipPath = path.join(dayDir, `cafe-park_${time}.zip`)
    await createZip(snapshotDir, zipPath)
    fs.rmSync(snapshotDir, { recursive: true, force: true })
    console.log(`\n✅ پوشه snapshot حذف شد (فقط zip نگه داشته شد)`)
  }

  console.log(`\n🎉 بکاپ کامل شد: backups/${date}/`)
  console.log(`   زمان: ${new Date().toLocaleString('fa-IR')}\n`)
}