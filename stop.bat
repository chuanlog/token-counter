@echo off
setlocal
chcp 65001 >nul
set "PORT=%~1"
if "%PORT%"=="" set "PORT=1236"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" -Port %PORT%
set "RC=%ERRORLEVEL%"
if "%~1"=="" pause >nul
endlocal & exit /b %RC%
