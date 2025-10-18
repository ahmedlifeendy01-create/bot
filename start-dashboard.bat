@echo off
echo Starting Dashboard only...
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please run build.bat first to create the .env file.
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo ERROR: node_modules not found!
    echo Please run build.bat first to install dependencies.
    echo.
    pause
    exit /b 1
)

REM Start the dashboard
echo Starting Dashboard...
echo Dashboard will be available at: http://localhost:3000
echo.
npm start
