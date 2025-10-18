@echo off
echo Stopping all Node.js processes...
echo.

REM Kill all node processes
taskkill /f /im node.exe 2>nul

if %errorlevel% equ 0 (
    echo All Node.js processes stopped successfully.
) else (
    echo No Node.js processes were running.
)

echo.
echo All processes stopped.
echo.
pause
