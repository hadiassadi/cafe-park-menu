# پچ ۴۹-ب — فیکس فوری مودال پشتیبان‌گیری: اجرای خودکار بکاپ + شروع دوباره

پیش‌نیاز: پچ ۴۹ مرج شده (PR #82). فقط ۲ فایل + RELEASE.

## ریشهٔ مشکل (از اسکرین‌شات ۳۸۱)
- دکمهٔ «🛡️ شروع پشتیبان‌گیری» فقط مودال را باز می‌کرد ولی `runBackup()` هرگز صدا زده
  نمی‌شد → چک‌لیست برای همیشه در «بخش ۰ از ۷» و همه ⏳ خشک می‌ماند؛ هیچ دکمهٔ اجرای
  دیگری هم داخل مودال نبود
- باگ خاموش دوم: ارزیابی پایان (`evaluateAndFinish`) از `items` داخل closure می‌خواند که
  هنگام شروع اجرا frozen شده — یعنی حتی اگر بخشی خطا می‌داد، تشخیص «ناقص» ممکن بود
  درست کار نکند → جایگزینی با `errorsRef` (مرج، بی‌تأثیر از state کهنه)

## فیکس‌ها (app/admin/backup/BackupClient.tsx)
1. دکمهٔ شروع → مودال باز می‌شود **و بلافاصله `runBackup()` اجرا می‌شود**
2. دکمهٔ «↺ شروع دوباره از ابتدا» داخل مودال (وقتی در حال اجرا نیست) — برای پس از پایان یا خطا
3. `errorsRef`: خطای هر بخش در ref ثبت/پاک می‌شود؛ ارزیابی پایان و برچسب بخش‌های ناموفق
   از همین مرج خوانده می‌شود (نام فایل INCOMPLETE و هشدار ناقص حالا قابل‌اعتماد است)
4. CSS: قاعدهٔ `.backup-restart-row` در انتهای globals.css

## دروازه‌ها
verifier CSS ✓ · `tsc --noEmit` ✓ · `next build` تولیدی ✓ · apply-check + تایپ پس از اعمال ✓

## اعمال (PowerShell)
```powershell
git checkout main && git pull
git checkout -b fix/patch-49b-backup-autostart
git apply --ignore-whitespace --verbose patch-49b-backup-autostart.patch
# صحت اعمال — انتظار:
(Select-String -Path "app\admin\backup\BackupClient.tsx" -Pattern "errorsRef").Count   # >= 4
(Select-String -Path "app\admin\backup\BackupClient.tsx" -Pattern "setModalOpen\(true\); runBackup\(\)").Count  # 1
(Select-String -Path "app\globals.css" -Pattern "backup-restart-row").Count            # 1
git add -A
git commit -m "fix(admin): patch 49b - backup modal auto-starts run + restart button + ref-based completion check"
git push -u origin fix/patch-49b-backup-autostart
```
سپس PR و merge: `https://github.com/hadiassadi/cafe-park-menu/compare/main...fix/patch-49b-backup-autostart`

## تست بعد از merge (کاربر)
1. `git checkout main` ← `git pull` ← ری‌استارت dev ← `Ctrl+F5`
2. پشتیبان‌گیری → «🛡️ شروع پشتیبان‌گیری» → مودال باز و **بلافاصله** بخش‌ها یکی‌یکی تیک بخورند
3. پایان: خلاصه + دانلود خودکار + «↺ شروع دوباره» فعال
4. بستن مودال و اجرای مجدد → از صفر شروع شود و باز خودکار برود
