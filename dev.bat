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
echo             [ Cafe Park - Developer Panel ]
echo.
echo  ============================================================
echo.
echo    [1]  🚀  Run project in dev mode  (npm run dev)
echo.
echo    [2]  🏗️   Build project  (npm run build)
echo.
echo    [3]  🌐  Run built version  (npm start)
echo.
echo    [4]  🔍  Run Linter  (npm run lint)
echo.
echo  ------------------------------------------------------------
echo.
echo    [5]  💾  Backup project  (npm run backup)
echo.
echo    [6]  🗑️   Clean old backups
echo.
echo    [7]  ⏰  Enable auto backup (every 24h)
echo.
echo    [8]  📂  Open backups folder
echo.
echo  ------------------------------------------------------------
echo.
echo    [9]  📤  Push changes to GitHub
echo.
echo    [A]  📥  Pull changes from GitHub
echo.
echo    [B]  📊  Show Git status
echo.
echo    [C]  📜  Show recent Git log
echo.
echo  ------------------------------------------------------------
echo.
echo    [D]  📋  Open PROJECT_STATE.md
echo.
echo    [E]  📁  Open project in VS Code
echo.
echo    [F]  🧹  Clear Next.js cache (.next)
echo.
echo  ------------------------------------------------------------
echo.
echo    [0]  🚪  Exit
echo.
echo  ============================================================
echo.
set /p choice="  Select: "

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
echo  [X] Invalid choice, try again.
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:DEV
cls
echo.
echo  🚀  Starting dev mode...
echo  ────────────────────────────────────────────
echo  [i] Press Ctrl+C to stop.
echo.
call npm run dev
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:BUILD
cls
echo.
echo  🏗️   Building project...
echo  ────────────────────────────────────────────
echo.
call npm run build
if %errorlevel%==0 (
  echo.
  echo  [OK]  Build successful!
) else (
  echo.
  echo  [ERR]  Build failed!
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:START
cls
echo.
echo  🌐  Running built version...
echo  ────────────────────────────────────────────
echo  [i] Press Ctrl+C to stop.
echo.
call npm start
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:LINT
cls
echo.
echo  🔍  Running ESLint...
echo  ────────────────────────────────────────────
echo.
call npm run lint
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:BACKUP
cls
echo.
echo  💾  Creating backup...
echo  ────────────────────────────────────────────
echo.
call npm run backup
if %errorlevel%==0 (
  echo.
  echo  [OK]  Backup created successfully!
) else (
  echo.
  echo  [ERR]  Backup failed!
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:CLEAN_BACKUP
cls
echo.
echo  🗑️   Cleaning backups older than 30 days...
echo  ────────────────────────────────────────────
echo.
call npm run backup:clean
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:SCHEDULE_BACKUP
cls
echo.
echo  ⏰  Enabling auto backup (every 24h)...
echo  ────────────────────────────────────────────
echo.
echo  [i] This window must stay open.
echo      Press Ctrl+C to stop.
echo.
start "Cafe Park Auto Backup" cmd /k "npm run backup:schedule"
echo  [OK]  Auto backup started in a new window.
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:OPEN_BACKUPS
cls
echo.
echo  📂  Opening backups folder...
if exist "backups" (
  start "" "backups"
  echo  [OK]  Folder opened.
) else (
  echo  [ERR]  backups folder not found. Create a backup first (option 5).
)
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:GIT_PUSH
cls
echo.
echo  📤  Pushing changes to GitHub
echo  ────────────────────────────────────────────
echo.
echo  📊  Current status:
echo.
git status --short
echo.
echo  ────────────────────────────────────────────
echo.
set /p commit_msg="  Commit message (empty = default): "
if "!commit_msg!"=="" set commit_msg=Update: %date% %time%

echo.
echo  [1/3]  Adding files...
git add .
echo.
echo  [2/3]  Committing...
git commit -m "!commit_msg!"
echo.
echo  [3/3]  Pushing...
git push
if %errorlevel%==0 (
  echo.
  echo  [OK]  Changes pushed successfully!
) else (
  echo.
  echo  [ERR]  Push failed! Try pull first (option A).
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:GIT_PULL
cls
echo.
echo  📥  Pulling changes from GitHub...
echo  ────────────────────────────────────────────
echo.
git pull
if %errorlevel%==0 (
  echo.
  echo  [OK]  Pull successful!
) else (
  echo.
  echo  [ERR]  Pull failed! Check for conflicts.
)
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:GIT_STATUS
cls
echo.
echo  📊  Git Status
echo  ────────────────────────────────────────────
echo.
git status
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:GIT_LOG
cls
echo.
echo  📜  Last 10 commits
echo  ────────────────────────────────────────────
echo.
git log --oneline -10
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:EDIT_STATE
cls
echo.
echo  📋  Opening PROJECT_STATE.md...
if exist "PROJECT_STATE.md" (
  start "" "PROJECT_STATE.md"
  echo  [OK]  File opened.
) else (
  echo  [ERR]  PROJECT_STATE.md not found!
)
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:OPEN_VSCODE
cls
echo.
echo  📁  Opening project in VS Code...
start "" code .
echo  [OK]  VS Code opened.
timeout /t 2 >nul
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:CLEAN_NEXT
cls
echo.
echo  🧹  Clearing Next.js cache (.next)...
echo  ────────────────────────────────────────────
echo.
if exist ".next" (
  rmdir /s /q ".next"
  echo  [OK]  .next folder removed.
) else (
  echo  [i]  .next folder not found.
)
echo.
echo  [i] It will be regenerated on next run.
pause
goto MAIN_MENU

:: ═══════════════════════════════════════════════════════════
:EXIT
cls
echo.
echo  ============================================================
echo.
echo             👋  Goodbye! Have a great day!
echo.
echo  ============================================================
echo.
timeout /t 2 >nul
exit