@echo off
chcp 65001 >nul 2>&1
title PRONO 2026 - Backend
cd /d "%~dp0\backend"

echo.
echo ================================================
echo  PRONO 2026 - Backend Python
echo ================================================
echo.

REM Detecter Python
set "PYTHON_CMD=python"
where python >nul 2>&1 || set "PYTHON_CMD=py"

REM Creer venv si manquant
if not exist "venv\" (
    echo Creation environnement Python...
    %PYTHON_CMD% -m venv venv
)

call venv\Scripts\activate.bat

REM Installer si pas encore fait
if not exist "venv\Lib\site-packages\fastapi\" (
    echo Installation des packages (1-2 min)...
    python -m pip install --upgrade pip --quiet
    pip install -r requirements.txt
)

echo.
echo Backend actif sur http://localhost:8000
echo Doc API     : http://localhost:8000/docs
echo Ctrl+C pour arreter
echo.
uvicorn main:app --port 8000 --host 0.0.0.0
pause
