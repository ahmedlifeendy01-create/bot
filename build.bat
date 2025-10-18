@echo off
echo Building Telegram Voting Bot Dashboard...
echo.

REM Install dependencies
echo Installing dependencies...
npm install

REM Create necessary directories
echo Creating directories...
if not exist "public" mkdir public
if not exist "public\images" mkdir public\images

REM Check if .env file exists
if not exist ".env" (
    echo Creating .env file...
    echo # Telegram Bot Configuration > .env
    echo TELEGRAM_BOT_TOKEN=your_bot_token_here >> .env
    echo. >> .env
    echo # Dashboard Authentication >> .env
    echo DASHBOARD_USER=admin >> .env
    echo DASHBOARD_PASS=admin123 >> .env
    echo. >> .env
    echo # Google Sheets Configuration >> .env
    echo GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id_here >> .env
    echo GOOGLE_APPLICATION_CREDENTIALS=your_service_account.json >> .env
    echo. >> .env
    echo # Server Configuration >> .env
    echo PORT=3000 >> .env
    echo. >> .env
    echo Please update .env file with your actual values!
)

echo.
echo Build completed successfully!
echo.
echo Next steps:
echo 1. Update .env file with your actual values
echo 2. Place your Google Sheets service account JSON file
echo 3. Run start.bat to start the application
echo.
pause
