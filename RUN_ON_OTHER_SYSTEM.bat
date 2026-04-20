@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ==============================================
echo Prime Pick One-Click Setup and Run (Windows)
echo ==============================================
echo.

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\Backend (Django)"
set "FRONTEND=%ROOT%\Frontend (React)"
set "BACKEND_ENV=%BACKEND%\.env"
set "VENV=%BACKEND6+%\.venv"

if not exist "%BACKEND%" (
  echo ERROR: Backend folder not found at:
  echo %BACKEND%
  pause
  exit /b 1
)

if not exist "%FRONTEND%" (
  echo ERROR: Frontend folder not found at:
  echo %FRONTEND%
  pause
  exit /b 1
)

where py >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python launcher ^(py^) is not installed or not in PATH.
  echo Install Python 3.11+ and try again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is not installed or not in PATH.
  echo Install Node.js LTS and try again.
  pause
  exit /b 1
)

echo [1/6] Checking env file...
if not exist "%BACKEND_ENV%" (
  echo.
  echo ERROR: Missing backend env file:
  echo %BACKEND_ENV%
  echo.
  echo Please place your shared .env file inside "Backend (Django)" and run this script again.
  pause
  exit /b 1
)

echo [2/6] Creating backend virtual environment if needed...
if not exist "%VENV%\Scripts\python.exe" (
  pushd "%BACKEND%"
  py -3 -m venv ".venv"
  if errorlevel 1 (
    popd
    echo ERROR: Could not create Python virtual environment.
    pause
    exit /b 1
  )
  popd
)

echo [3/6] Installing backend dependencies...
pushd "%BACKEND%"
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
  popd
  echo ERROR: Backend dependency installation failed.
  pause
  exit /b 1
)

echo [4/6] Applying database migrations...
python manage.py migrate
if errorlevel 1 (
  popd
  echo ERROR: Django migrations failed.
  pause
  exit /b 1
)
popd

echo [5/6] Installing frontend dependencies...
pushd "%FRONTEND%"
npm install
if errorlevel 1 (
  popd
  echo ERROR: Frontend dependency installation failed.
  pause
  exit /b 1
)
popd

echo [6/6] Starting backend and frontend...
start "Prime Pick Backend" cmd /k "cd /d ""%BACKEND%"" && call "".venv\Scripts\activate.bat"" && python manage.py runserver"
start "Prime Pick Frontend" cmd /k "cd /d ""%FRONTEND%"" && npm run dev"

echo.
echo Done. Two new windows were opened:
echo - Backend: http://127.0.0.1:8000
echo - Frontend: usually http://127.0.0.1:5173
echo.
echo Keep both windows running while using the app.
pause
exit /b 0
