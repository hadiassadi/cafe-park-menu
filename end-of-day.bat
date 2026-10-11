@echo off
chcp 65001 >nul
title End of Day - Cafe Park
color 0A

echo.
echo  ============================================================
echo             🌙  پایان روز کاری - کافه پارک  🌙
echo  ============================================================
echo.

:: 1. بکاپ
echo  [1/4]  💾  در حال بکاپ‌گیری...
call npm run backup
if %errorlevel% neq 0 (
  echo  ❌  بکاپ با خطا مواجه شد!
  pause
  exit /b 1
)
echo.

:: 2. پاکسازی بکاپ‌های قدیمی
echo  [2/4]  🗑️   پاکسازی بکاپ‌های قدیمی...
call npm run backup:clean
echo.

:: 3. Git Push
echo  [3/4]  📤  ارسال تغییرات به GitHub...
git status --short
echo.
set /p commit_msg="  💬 پیام کامیت (خالی = پیام پیش‌فرض): "
if "%commit_msg%"=="" set commit_msg=Auto-commit: %date% %time%
git add .
git commit -m "%commit_msg%"
git push
echo.

:: 4. باز کردن PROJECT_STATE.md برای آپدیت
echo  [4/4]  📋  باز کردن PROJECT_STATE.md برای آپدیت...
echo.
echo  ⚠️  یادت نره فایل PROJECT_STATE.md رو آپدیت کنی!
echo.
start "" "PROJECT_STATE.md"

echo.
echo  ============================================================
echo             ✅  همه کارهای پایان روز انجام شد!
echo  ============================================================
echo.
echo  💡  حالا فایل PROJECT_STATE.md رو ویرایش کن و ذخیره کن.
echo.
pause