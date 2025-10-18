@echo off
echo Clearing Next.js cache...
rmdir /s /q .next
echo Cache cleared!
echo.
echo Please restart your dev server with: npm run dev
pause
