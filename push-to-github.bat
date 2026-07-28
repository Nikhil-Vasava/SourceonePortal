@echo off
REM ---------------------------------------------------------------------------
REM  Pushes this folder to GitHub properly.
REM
REM  The GitHub website's drag-and-drop uploader silently skips dotfiles
REM  (.gitignore, .env.example) and it's easy to miss the loose root files.
REM  Git handles all of them correctly, and obeys .gitignore so your real
REM  .env and API keys stay private.
REM
REM  Run this by double-clicking it, or from a terminal in this folder.
REM ---------------------------------------------------------------------------

setlocal
cd /d "%~dp0"

echo.
echo === SourceOne ERP -^> GitHub =================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: git is not installed.
  echo Install it from https://git-scm.com/download/win then run this again.
  echo.
  pause
  exit /b 1
)

if not exist ".gitignore" (
  echo ERROR: .gitignore is missing from this folder.
  echo Without it your .env file could be published. Stopping.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initialising the repository...
  git init -q
  git branch -M main
)

echo Setting the remote...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/Nikhil-Vasava/SourceonePortal.git

echo Staging files (.gitignore excludes .env, node_modules and .next)...
git add -A

echo.
echo === These files will be committed ===========================
git status --short
echo.

REM Safety net: refuse to continue if a secret somehow got staged.
git diff --cached --name-only | findstr /R /C:"^\.env$" >nul
if not errorlevel 1 (
  echo.
  echo STOPPED: .env is staged and would be published.
  echo Check that .gitignore contains a line reading  .env
  echo.
  pause
  exit /b 1
)

echo Committing...
git commit -q -m "SourceOne ERP - full project" || echo (nothing new to commit)

echo.
echo Pushing to GitHub. This replaces what is currently on main.
echo Your browser or Git Credential Manager may ask you to sign in.
echo.
pause

git push -u origin main --force

echo.
if errorlevel 1 (
  echo Push failed. The most common cause is authentication -
  echo sign in when prompted, or use a personal access token as the password.
) else (
  echo Done. Check https://github.com/Nikhil-Vasava/SourceonePortal
  echo You should now see package.json in the file list.
)
echo.
pause
endlocal
