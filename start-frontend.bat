@echo off
chcp 65001 >nul 2>&1
title PRONO 2026 - Frontend
cd /d "%~dp0\frontend"

echo.
echo ================================================
echo  PRONO 2026 - Frontend React
echo ================================================
echo.

REM Installer si pas encore fait
if not exist "node_modules\" (
    echo Installation des packages npm (2-3 min)...
    call npm install
)

echo.
echo Frontend sur http://localhost:5173
echo Le navigateur va s'ouvrir automatiquement
echo Ctrl+C pour arreter
echo.
call npm run dev
pause
