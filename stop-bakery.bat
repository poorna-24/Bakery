@echo off
REM Double-click this to stop the bakery.
REM
REM The database and the uploaded photos are kept — they live in named Docker
REM volumes, not inside the containers, so stopping does not touch them.

cd /d "%~dp0"

echo Stopping the bakery...
echo.

docker compose down

echo.
echo Stopped. The database and photos are kept.
echo.
pause
