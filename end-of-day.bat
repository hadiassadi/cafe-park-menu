@echo off
chcp 65001 >nul
title End of Day - Cafe Park
color 0A

echo.
echo  ============================================================
echo             🌙  End of Day - Cafe Park  🌙
echo  ============================================================
echo.

:: ═══════════════════════════════════════════════════════════
:: Step 1: Backup
:: ═══════════════════════════════════════════════════════════
echo  [1/5]  💾  Creating backup...
echo  ────────────────────────────────────────────
call npm run backup
if %errorlevel% neq 0 (
  echo.
  echo  [ERR]  Backup failed! Aborting.
  pause
  exit /b 1
)
echo.

:: ═══════════════════════════════════════════════════════════
:: Step 2: Clean old backups
:: ═══════════════════════════════════════════════════════════
echo  [2/5]  🗑️   Cleaning backups older than 30 days...
echo  ────────────────────────────────────────────
call npm run backup:clean
echo.

:: ═══════════════════════════════════════════════════════════
:: Step 3: Pull from GitHub
:: ═══════════════════════════════════════════════════════════
echo  [3/5]  📥  Pulling changes from GitHub...
echo  ────────────────────────────────────────────
git pull origin main --rebase --autostash
if %errorlevel% neq 0 (
  echo.
  echo  [ERR]  Pull failed! You may have conflicts.
  echo         Please resolve manually: git status
  pause
  exit /b 1
)
echo.

:: ═══════════════════════════════════════════════════════════
:: Step 4: Commit and Push
:: ═══════════════════════════════════════════════════════════
echo  [4/5]  📤  Pushing changes to GitHub...
echo  ────────────────────────────────────────────
echo.
echo  📊  Current status:
git status --short
echo.
set /p commit_msg="  💬 Commit message (empty = default): "
if "%commit_msg%"=="" set commit_msg=Auto-commit: %date% %time%

git add .
git commit -m "%commit_msg%" 2>nul
git push origin main
if %errorlevel% neq 0 (
  echo.
  echo  [ERR]  Push failed!
  echo         Please check: git status
  pause
  exit /b 1
)
echo.

:: ═══════════════════════════════════════════════════════════
:: Step 5: Open PROJECT_STATE.md for editing
:: ═══════════════════════════════════════════════════════════
echo  [5/5]  📋  Opening PROJECT_STATE.md for update...
start "" "PROJECT_STATE.md"

echo.
echo  ============================================================
echo             ✅  All end-of-day tasks completed!
echo  ============================================================
echo.
echo  💡  Don't forget to edit and save PROJECT_STATE.md
echo.
pause