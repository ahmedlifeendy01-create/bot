@echo off
echo Starting Telegram Voting Bot Dashboard...
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
start "Dashboard" cmd /k "cd /d %~dp0 && npm start"

REM Wait a moment
timeout /t 3 /nobreak > nul

REM Start the bot
echo Starting Bot...
start "Bot" cmd /k "cd /d %~dp0 && npm run bot"

echo.
echo Both Dashboard and Bot are starting...
echo.
echo Dashboard will be available at: http://localhost:3000
echo Bot will be running on Telegram
echo.
echo Press any key to close this window...
pause > nul
