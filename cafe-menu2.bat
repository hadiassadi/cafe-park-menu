@echo off
setlocal
rem ------------------------------------------------------------
rem  Cafe Park Menu - one-click tools
rem  Put this file next to package.json (project root) and double-click it.
rem ------------------------------------------------------------
cd /d "%~dp0"
title Cafe Park Menu - Tools

if not exist "package.json" (
  echo ERROR: package.json not found in this folder.
  echo Move this file to the project root, next to package.json.
  pause
  exit /b 1
)

:menu
cls
echo ==========================================
echo    Cafe Park Menu - Tools
echo ==========================================
echo    1^) Start local dev server   [npm run dev]
echo    2^) Check build only         [npm run build]
echo    3^) Test production locally  [build + start]
echo    4^) DEPLOY: build + commit + push
echo    5^) Install packages         [npm install]
echo    6^) Create snapshot zip      [to share with Claude, no secrets]
echo    0^) Exit
echo.
set "CHOICE="
set /p CHOICE=Choose a number: 
if "%CHOICE%"=="1" goto dev
if "%CHOICE%"=="2" goto build
if "%CHOICE%"=="3" goto prod
if "%CHOICE%"=="4" goto deploy
if "%CHOICE%"=="5" goto install
if "%CHOICE%"=="6" goto snapshot
if "%CHOICE%"=="0" goto end
goto menu

:dev
echo.
echo Starting dev server. Open http://localhost:3000  [Ctrl+C to stop]
call npm run dev
pause
goto menu

:build
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Fix the errors shown above.
) else (
  echo.
  echo BUILD OK.
)
pause
goto menu

:prod
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Fix the errors shown above.
  pause
  goto menu
)
echo.
echo Starting production server. Open http://localhost:3000  [Ctrl+C to stop]
call npm run start
pause
goto menu

:install
echo.
call npm install
pause
goto menu

:snapshot
echo.
set "ZIP=%~dp0..\cafe-park-snapshot.zip"
if exist "%ZIP%" del "%ZIP%"
echo Creating snapshot (without node_modules, .next, .git and .env files) ...
tar -a -c -f "%ZIP%" --exclude=node_modules --exclude=.next --exclude=.git --exclude=.vercel --exclude=.env* --exclude=*.zip .
if errorlevel 1 goto snapfail
echo.
echo Created: %ZIP%
for %%F in ("%ZIP%") do echo Size: %%~zF bytes
echo Attach this zip to the chat. It contains no passwords or keys.
pause
goto menu

:snapfail
echo.
echo SNAPSHOT FAILED. Make sure Windows tar is available [Windows 10 or newer].
pause
goto menu

:deploy
echo.
echo [1/4] Building ...
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED - nothing was pushed. Fix the errors above first.
  pause
  goto menu
)

echo.
echo [2/4] Staging project files ...
for %%P in (app lib public package.json package-lock.json next.config.ts next.config.js next.config.mjs tsconfig.json) do (
  if exist "%%P" git add "%%P"
)

echo.
echo Files that will be committed:
git status --short
echo.

git diff --cached --quiet
if not errorlevel 1 (
  echo Nothing to commit. Everything is already saved.
  pause
  goto menu
)

git diff --cached --name-only | findstr /i /r "\.bak$" >nul
if not errorlevel 1 (
  echo WARNING: backup files [.bak] are in the list above.
  echo They should not be pushed. Answer n, remove them, and run again.
  echo.
)

set "OK="
set /p OK=Commit and push these files? [y/n]: 
if /i not "%OK%"=="y" (
  git reset -q
  echo Cancelled. Nothing was committed.
  pause
  goto menu
)

echo.
set "MSG="
set /p MSG=Commit message [Enter = "update menu"]: 
if "%MSG%"=="" set "MSG=update menu"

echo.
echo [3/4] Committing ...
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo COMMIT FAILED. If git asks for your name and email, run:
  echo   git config --global user.name "Your Name"
  echo   git config --global user.email "you@example.com"
  pause
  goto menu
)

echo.
echo [4/4] Pushing ...
git push
if errorlevel 1 (
  echo.
  echo PUSH FAILED. Check your internet and GitHub login, then run again.
  pause
  goto menu
)

echo.
echo DONE. Vercel deploys automatically - wait 1 to 2 minutes, then check the site.
set "OPEN="
set /p OPEN=Open the live site now? [y/n]: 
if /i "%OPEN%"=="y" start "" https://cafe-park-menu.vercel.app
pause
goto menu

:end
endlocal
exit /b 0
