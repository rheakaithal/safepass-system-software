@echo off
title RIPPLE Dashboard - Simulation Mode
color 0B

echo.
echo                .d8888b.  8888888b.   .d8888b.
echo               d88P  Y88b 888   Y88b d88P  Y88b
echo               Y88b.      888    888 Y88b.
echo                "Y888b.   888   d88P  "Y888b.
echo                   "Y88b. 8888888P"      "Y88b.
echo                     "888 888              "888
echo               Y88b  d88P 888        Y88b  d88P
echo                "Y8888P"  888         "Y8888P"
echo.
timeout /t 1 /nobreak > nul
echo  ==========================================================
echo                     SAFE  PASS  SYSTEMS
echo  ==========================================================
echo                      ~  R I P P L E  ~
echo                  Rural Road Flood Detection
echo  ==========================================================
timeout /t 1 /nobreak > nul
echo              **  S I M U L A T I O N   M O D E  **
echo.
echo         No MySQL database or MQTT broker required.
echo         All sensor data and hardware responses are
echo         generated locally by the simulation server.
echo  ==========================================================
timeout /t 1 /nobreak > nul
echo.
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
timeout /t 2 /nobreak > nul

:: ── Navigate to project directory ───────────────────────────────────────────
cd /d "\sps-dashboard"
if %ERRORLEVEL% neq 0 (
    echo 	[ERROR] Could not find project folder.
    echo        	Check that this path exists:
    echo         	C:\Users\parke\Desktop\SPS_UI\safepass-system-software\sps-dashboard
    pause
    exit /b 1
)
echo 	[OK] Project folder found

timeout /t 1 /nobreak > nul

:: ── Step 1: Check Node.js is installed ──────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 	[ERROR] Node.js is not installed or not in PATH.
    echo        	Download it from https://nodejs.org
    pause
    exit /b 1
)
echo 	[OK] Node.js found

timeout /t 1 /nobreak > nul

:: ── Step 2: Check database-test.js exists ───────────────────────────────────
if not exist "scripts\database-test.js" (
    echo 	[ERROR] scripts\database-test.js not found.
    echo        	Expected at: %CD%\scripts\database-test.js
    echo        	Make sure the simulation script exists and try again.
    pause
    exit /b 1
)
echo 	[OK] Simulation script found

timeout /t 1 /nobreak > nul

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

timeout /t 1 /nobreak > nul

:: ── Step 4: Set port (simulation always runs on 80) ─────────────────────────
set PORT=80
echo 	[OK] Port set to %PORT%

timeout /t 2 /nobreak > nul

:: ── Step 5: Open browser after a short delay ────────────────────────────────
echo.
echo  [Sim] Starting RIPPLE Simulation Server...
echo  [Sim] Opening http://localhost:%PORT% in 3 seconds...
echo.
echo       Simulated hardware:
echo         MySQL database  ^|  Fully mocked - no connection needed
echo         MQTT broker     ^|  Fully mocked - no connection needed
echo         Sensor poles    ^|  Realistic water level data generated locally
echo         Camera MCUs     ^|  Image request simulated with realistic delay
echo.
echo         Press Ctrl+C to stop the simulation server.
echo  ==========================================================
echo.

timeout /t 1 /nobreak > nul

ping 127.0.0.1 -n 4 >nul
start "" "http://localhost:%PORT%"

timeout /t 1 /nobreak > nul

:: ── Step 6: Start the simulation server ─────────────────────────────────────
node scripts/database-test.js

timeout /t 1 /nobreak > nul

:: ── Step 7: If server exits, pause so you can read any errors ───────────────
echo.
echo  ==========================================================
echo  [STOPPED] Simulation server exited.
echo            Check the output above for errors.
echo  ==========================================================
pause