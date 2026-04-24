@echo off
title RIPPLE Dashboard - Safe Pass Systems
color 0A

echo.
echo              .d8888b.  8888888b.   .d8888b.
echo             d88P  Y88b 888   Y88b d88P  Y88b
echo             Y88b.      888    888 Y88b.
echo              "Y888b.   888   d88P  "Y888b.
echo                 "Y88b. 8888888P"      "Y88b.
echo                   "888 888              "888
echo             Y88b  d88P 888        Y88b  d88P
echo              "Y8888P"  888         "Y8888P"
echo.
timeout /t 1 > nul 
echo  ==========================================================
echo                     SAFE  PASS  SYSTEMS              
echo  ==========================================================
echo                      ~  R I P P L E  ~
echo                  Rural Road Flood Detection
echo  ==========================================================
timeout /t 1 > nul 
echo             Texas A^&M University  ^|  ESET 420
echo             Emergency Services Dashboard v4.1
echo  ==========================================================
echo.
timeout /t 2 > nul 
echo         Dashboard Author:
echo           Parker Williamson  ^|  Software Engineer I
echo.
echo         Team:
echo           Evelyn Beck-Davis  ^|  Project Manager
echo           Rhea Kaithal       ^|  Software Engineer II
echo           Robert Beal        ^|  Communications Engineer
echo           Logan Sawyer       ^|  Firmware Engineer
echo           Aduke Pommel       ^|  Hardware Engineer
echo           David Soto         ^|  Test Engineer
echo.
echo  ==========================================================
echo.
echo  Checking Dependencies...
timeout /t 2 > nul 

:: ── Navigate to project directory ───────────────────────────────────────────
cd /d "sps-dashboard"
if %ERRORLEVEL% neq 0 (
    echo 	[ERROR] Could not find project folder.
    echo        	Check that this path exists:
    echo         	C:\Users\parke\Desktop\SPS_UI\safepass-system-software\sps-dashboard
    pause
    exit /b 1
)
echo 	[OK] Project folder found

timeout /t 1 > nul 

:: ── Step 1: Check Node.js is installed ──────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 	[ERROR] Node.js is not installed or not in PATH.
    echo        	Download it from https://nodejs.org
    pause
    exit /b 1
)
echo 	[OK] Node.js found

timeout /t 1 > nul 

:: ── Step 2: Check .env file exists ──────────────────────────────────────────
:: Windows "if not exist" is unreliable with dotfiles (.env), so we use "dir" instead.
dir /b "scripts\ripple.env" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 	[ERROR] scripts\ripple.env file not found.
    echo        	Expected at: %CD%\scripts\ripple.env
    echo        	Make sure the file exists and try again.
    pause
    exit /b 1
)
echo 	[OK] .env file found

timeout /t 1 > nul 

:: ── Step 3: Install dependencies if node_modules is missing ─────────────────
if not exist "node_modules\" (
    echo.
    echo 	[Setup] node_modules not found — running npm install...
    echo        	This only happens once.
    echo.
    npm install
    if %ERRORLEVEL% neq 0 (
        echo 	[ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo 	[OK] Dependencies installed
) else (
    echo 	[OK] Dependencies found
)

timeout /t 1 > nul 

:: ── Step 4: Read WEBSITE_PORT from scripts\ripple.env ──────────────────────
set PORT=3000
for /f "usebackq tokens=1,* delims==" %%A in ("scripts\ripple.env") do (
    if /i "%%A"=="WEBSITE_PORT" set PORT=%%B
)
echo 	[OK] Port set to %PORT%

timeout /t 2 > nul

:: ── Step 5: Open browser after a short delay ────────────────────────────────
echo.
echo  [Server] Starting RIPPLE Dashboard...
echo  [Server] Opening http://localhost:%PORT% in 2 seconds...
echo.
echo          Press Ctrl+C to stop the server.
echo  ==========================================================
echo.

timeout /t 1 > nul 

ping 127.0.0.1 -n 3 >nul
start "" "http://localhost:%PORT%"

timeout /t 1 > nul 

:: ── Step 6: Start the server ────────────────────────────────────────────────
node scripts/database.js

timeout /t 1 > nul 

:: ── Step 7: If server exits, pause so you can read any errors ───────────────
echo.
echo  ==========================================================
echo  [STOPPED] Server exited.
echo           Check the output above for errors.
echo  ==========================================================
pause