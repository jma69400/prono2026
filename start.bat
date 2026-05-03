@echo off
chcp 65001 >nul 2>&1
title PRONO 2026 - Lancement
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ================================================
echo   PRONO 2026 - Coupe du Monde
echo ================================================
echo.

REM ============================================================
REM ETAPE 0 : verification des prerequis
REM ============================================================
echo [Verification des prerequis...]
echo.

REM Detecter Python (python ou py)
set "PYTHON_CMD="
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=py"
    )
)

if "!PYTHON_CMD!"=="" (
    echo [X] Python introuvable.
    echo.
    echo Installe Python 3.11 ou plus :
    echo   https://www.python.org/downloads/
    echo.
    echo IMPORTANT : pendant l'installation, coche la case
    echo             "Add python.exe to PATH"
    echo.
    pause
    exit /b 1
)
echo [OK] Python trouve : !PYTHON_CMD!
!PYTHON_CMD! --version

REM Detecter Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [X] Node.js introuvable.
    echo.
    echo Installe Node.js 18 ou plus :
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js trouve
node --version

REM Detecter npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [X] npm introuvable. Reinstalle Node.js depuis nodejs.org
    pause
    exit /b 1
)
echo [OK] npm trouve
call npm --version
echo.

REM ============================================================
REM ETAPE 1 : setup backend
REM ============================================================
echo ================================================
echo  [1/4] Installation du backend Python
echo ================================================
echo.

cd backend

if not exist "venv\" (
    echo Creation de l'environnement virtuel...
    !PYTHON_CMD! -m venv venv
    if !errorlevel! neq 0 (
        echo.
        echo [X] Echec de la creation du venv.
        echo Essaie : !PYTHON_CMD! -m pip install --upgrade virtualenv
        pause
        exit /b 1
    )
)

echo Activation du venv et installation des packages...
call venv\Scripts\activate.bat

REM Mettre a jour pip silencieusement
python -m pip install --upgrade pip --quiet

REM Installer les dependances
echo Installation de fastapi, uvicorn, etc. (peut prendre 2 min)...
pip install -r requirements.txt
if !errorlevel! neq 0 (
    echo.
    echo [!] Erreur d'installation. Si l'erreur concerne 'argon2' :
    echo     Installe Microsoft C++ Build Tools :
    echo     https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo.
    pause
    exit /b 1
)

echo [OK] Backend pret
cd ..
echo.

REM ============================================================
REM ETAPE 2 : demarrage du backend (nouvelle fenetre)
REM ============================================================
echo ================================================
echo  [2/4] Demarrage du backend (nouvelle fenetre)
echo ================================================
echo.

start "PRONO 2026 - Backend (port 8000)" cmd /k "cd /d %CD%\backend && call venv\Scripts\activate.bat && echo Backend actif sur http://localhost:8000 && echo. && uvicorn main:app --port 8000 --host 0.0.0.0"

echo Attente du demarrage du backend (5 sec)...
timeout /t 5 /nobreak >nul
echo.

REM ============================================================
REM ETAPE 3 : setup frontend
REM ============================================================
echo ================================================
echo  [3/4] Installation du frontend Node.js
echo ================================================
echo.

cd frontend

if not exist "node_modules\" (
    echo Installation des packages npm (peut prendre 2-3 min)...
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo [X] Echec npm install. Verifie ta connexion Internet.
        pause
        exit /b 1
    )
)
echo [OK] Frontend pret
echo.

REM ============================================================
REM ETAPE 4 : demarrage du frontend
REM ============================================================
echo ================================================
echo   PRONO 2026 EST LANCE !
echo ================================================
echo.
echo  Site web    : http://localhost:5173
echo  API backend : http://localhost:8000
echo  Doc API     : http://localhost:8000/docs
echo.
echo  Comptes :
echo   admin@prono26.com / admin123  (admin)
echo   demo@prono26.com  / demo123   (utilisateur)
echo.
echo  Ferme cette fenetre ET la fenetre du backend
echo  pour tout arreter.
echo ================================================
echo.

call npm run dev

endlocal
