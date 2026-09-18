@echo off
REM Double-click this to start the bakery, or run it from any terminal.
REM
REM It changes to its own folder first, so it works no matter where it is
REM launched from — including a terminal left sitting in a folder that has
REM since been renamed or deleted.

cd /d "%~dp0"

echo Starting the bakery...
echo.

docker compose up -d
if errorlevel 1 goto failed

echo.
echo   Customer menu    http://localhost:3000
echo   Admin dashboard  http://localhost:3001
echo.
echo   To stop:  stop-bakery.bat
echo.
pause
exit /b 0

:failed
echo.
echo Could not start. Is Docker Desktop running?
echo.
pause
exit /b 1
