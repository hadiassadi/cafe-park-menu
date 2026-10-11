@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Cafe Park - Dev Menu
color 0E

:MAIN_MENU
cls
echo.
echo  ============================================================
echo.
echo             ☕  کافه پارک - پنل توسعه‌دهنده  ☕
echo.
echo  ============================================================
echo.
echo    [1]  🚀  اجرای پروژه در حالت توسعه (npm run dev)
echo.
echo    [2]  🏗️   بیلد گرفتن پروژه (npm run build)
echo.
echo    [3]  🌐  اجرای نسخه Build شده (npm start)
echo.
echo    [4]  🔍  اجرای Linter (npm run lint)
echo.
echo  ------------------------------------------------------------
echo.
echo    [5]  💾  بکاپ‌گیری از پروژه (npm run backup)
echo.
echo    [6]  🗑️   پاکسازی بکاپ‌های قدیمی
echo.
echo    [7]  ⏰  فعال‌سازی بکاپ خودکار (هر ۲۴ ساعت)
echo.
echo    [8]  📂  باز کردن پوشه بکاپ‌ها در ویندوز
echo.
echo  ------------------------------------------------------------
echo.
echo    [9]  📤  ارسال تغییرات به GitHub (commit + push)
echo.
echo    [A]  📥  دریافت تغییرات از GitHub (pull)
echo.
echo    [B]  📊  نمایش وضعیت Git (status)
echo.
echo    [C]  📜  نمایش لاگ اخیر Git (10 کامیت آخر)
echo.
echo  ------------------------------------------------------------
echo.
echo    [D]  📋  باز کردن فایل PROJECT_STATE.md برای ویرایش
echo.
echo    [E]  📁  باز کردن پروژه در VS Code
echo.
echo    [F]  🧹  پاک کردن کش Next.js (.next)
echo.
echo  ------------------------------------------------------------
echo.
echo    [0]  🚪  خروج
echo.
echo  ============================================================
echo.
set /p choice="  👉 انتخاب شما: "

if /i "%choice%"=="1" goto DEV
if /i "%choice%"=="2" goto BUILD
if /i "%choice%"=="3" goto START
if /i "%choice%"=="4" goto LINT
if /i "%choice%"=="5" goto BACKUP
if /i "%choice%"=="6" goto CLEAN_BACKUP
if /i "%choice%"=="7" goto SCHEDULE_BACKUP
if /i "%choice%"=="8" goto OPEN_BACKUPS
if /i "%choice%"=="9" goto GIT_PUSH
if /i "%choice%"=="A" goto GIT_PULL
if /i "%choice%"=="B" goto GIT_STATUS
if /i "%choice%"=="C" goto GIT_LOG
if /i "%choice%"=="D" goto EDIT_STATE
if /i "%choice%"=="E" goto OPEN_VSCODE
if /i "%choice%"=="F" goto CLEAN_NEXT
if /i "%choice%"=="0" goto EXIT
echo.
echo  ❌ انتخاب نامعتبر! دوباره تلاش کن.
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 1. اجرای پروژه
:: ═══════════════════════════════════════════════════════════
:DEV
cls
echo.
echo  🚀  اجرای پروژه در حالت توسعه...
echo  ────────────────────────────────────────────
echo  💡 برای توقف، Ctrl+C را بزن.
echo.
call npm run dev
echo.
echo  ⏸️  پروژه متوقف شد.
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 2. بیلد گرفتن
:: ═══════════════════════════════════════════════════════════
:BUILD
cls
echo.
echo  🏗️   در حال بیلد گرفتن پروژه...
echo  ────────────────────────────────────────────
echo.
call npm run build
if %errorlevel%==0 (
  echo.
  echo  ✅  بیلد با موفقیت انجام شد!
) else (
  echo.
  echo  ❌  بیلد با خطا مواجه شد!
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 3. اجرای نسخه Build
:: ═══════════════════════════════════════════════════════════
:START
cls
echo.
echo  🌐  اجرای نسخه Build شده...
echo  ────────────────────────────────────────────
echo  💡 برای توقف، Ctrl+C را بزن.
echo.
call npm start
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 4. Linter
:: ═══════════════════════════════════════════════════════════
:LINT
cls
echo.
echo  🔍  بررسی کدها با ESLint...
echo  ────────────────────────────────────────────
echo.
call npm run lint
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 5. بکاپ‌گیری
:: ═══════════════════════════════════════════════════════════
:BACKUP
cls
echo.
echo  💾  در حال بکاپ‌گیری از پروژه...
echo  ────────────────────────────────────────────
echo.
call npm run backup
if %errorlevel%==0 (
  echo.
  echo  ✅  بکاپ با موفقیت ساخته شد!
) else (
  echo.
  echo  ❌  بکاپ با خطا مواجه شد!
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 6. پاکسازی بکاپ‌های قدیمی
:: ═══════════════════════════════════════════════════════════
:CLEAN_BACKUP
cls
echo.
echo  🗑️   پاکسازی بکاپ‌های قدیمی‌تر از ۳۰ روز...
echo  ────────────────────────────────────────────
echo.
call npm run backup:clean
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 7. بکاپ خودکار
:: ═══════════════════════════════════════════════════════════
:SCHEDULE_BACKUP
cls
echo.
echo  ⏰  فعال‌سازی بکاپ خودکار (هر ۲۴ ساعت)...
echo  ────────────────────────────────────────────
echo.
echo  ⚠️  این ترمینال باید باز بماند تا بکاپ خودکار کار کند.
echo     برای توقف، Ctrl+C را بزن.
echo.
start "Cafe Park Auto Backup" cmd /k "npm run backup:schedule"
echo  ✅  ترمینال بکاپ خودکار در یک پنجره جدا باز شد.
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 8. باز کردن پوشه بکاپ‌ها
:: ═══════════════════════════════════════════════════════════
:OPEN_BACKUPS
cls
echo.
echo  📂  در حال باز کردن پوشه بکاپ‌ها...
if exist "backups" (
  start "" "backups"
  echo  ✅  پوشه بکاپ باز شد.
) else (
  echo  ❌  پوشه backups وجود ندارد! اول یک بکاپ بگیر (گزینه ۵).
)
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: 9. ارسال تغییرات به GitHub
:: ═══════════════════════════════════════════════════════════
:GIT_PUSH
cls
echo.
echo  📤  ارسال تغییرات به GitHub
echo  ────────────────────────────────────────────
echo.
echo  📊  وضعیت فعلی Git:
echo.
git status --short
echo.
echo  ────────────────────────────────────────────
echo.
set /p commit_msg="  💬 پیام کامیت (یا Enter برای پیام پیش‌فرض): "
if "!commit_msg!"=="" set commit_msg=Update: %date% %time%

echo.
echo  📥  در حال افزودن فایل‌ها...
git add .
echo.
echo  💾  در حال کامیت...
git commit -m "!commit_msg!"
echo.
echo  📤  در حال ارسال به GitHub...
git push
if %errorlevel%==0 (
  echo.
  echo  ✅  تغییرات با موفقیت ارسال شد!
) else (
  echo.
  echo  ❌  خطا در ارسال! احتمالاً باید اول pull کنی (گزینه A).
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: A. دریافت تغییرات از GitHub
:: ═══════════════════════════════════════════════════════════
:GIT_PULL
cls
echo.
echo  📥  دریافت تغییرات از GitHub...
echo  ────────────────────────────────────────────
echo.
git pull
if %errorlevel%==0 (
  echo.
  echo  ✅  تغییرات با موفقیت دریافت شد!
) else (
  echo.
  echo  ❌  خطا در دریافت! احتمالاً تعارض (conflict) داری.
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: B. وضعیت Git
:: ═══════════════════════════════════════════════════════════
:GIT_STATUS
cls
echo.
echo  📊  وضعیت فعلی Git
echo  ────────────────────────────────────────────
echo.
git status
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: C. لاگ Git
:: ═══════════════════════════════════════════════════════════
:GIT_LOG
cls
echo.
echo  📜  ۱۰ کامیت آخر
echo  ────────────────────────────────────────────
echo.
git log --oneline -10
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: D. ویرایش فایل وضعیت پروژه
:: ═══════════════════════════════════════════════════════════
:EDIT_STATE
cls
echo.
echo  📋  باز کردن فایل PROJECT_STATE.md...
if exist "PROJECT_STATE.md" (
  start "" "PROJECT_STATE.md"
  echo  ✅  فایل باز شد.
) else (
  echo  ❌  فایل PROJECT_STATE.md پیدا نشد!
)
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: E. باز کردن پروژه در VS Code
:: ═══════════════════════════════════════════════════════════
:OPEN_VSCODE
cls
echo.
echo  📁  در حال باز کردن پروژه در VS Code...
start "" code .
echo  ✅  VS Code باز شد.
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: F. پاک کردن کش Next.js
:: ═══════════════════════════════════════════════════════════
:CLEAN_NEXT
cls
echo.
echo  🧹  پاک کردن کش Next.js (.next)...
echo  ────────────────────────────────────────────
echo.
if exist ".next" (
  rmdir /s /q ".next"
  echo  ✅  پوشه .next پاک شد.
) else (
  echo  ℹ️  پوشه .next وجود ندارد.
)
echo.
echo  💡  دفعه بعد که پروژه را اجرا کنی، از نو ساخته می‌شود.
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:: خروج
:: ═══════════════════════════════════════════════════════════
:EXIT
cls
echo.
echo  ============================================================
echo.
echo             👋  خدانگهدار! روز خوبی داشته باشی!
echo.
echo  ============================================================
echo.
timeout /t 2 >nul
exit