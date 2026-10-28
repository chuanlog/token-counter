@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [Token Lens] Node.js was not found.
  echo Please install Node.js 22.5 or newer. Node 24 LTS is recommended.
  echo   https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
echo [Token Lens] Starting local dashboard...
echo.
node --experimental-sqlite server/index.js %*
if errorlevel 1 (
  echo.
  echo [Token Lens] The server exited with an error. See the message above.
  pause
)
endlocal
