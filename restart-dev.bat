@echo off
echo ======================================
echo Restarting Next.js Development Server
echo ======================================

echo.
echo Step 1: Stopping any running dev servers...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Step 2: Clearing Next.js cache...
if exist .next (
    rmdir /S /Q .next
    echo .next folder removed
) else (
    echo .next folder not found (already clean)
)

echo.
echo Step 3: Starting development server...
echo.
npm run dev
