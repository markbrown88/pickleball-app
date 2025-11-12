# Stripe Webhook Local Setup Script for Windows
# This script helps you set up Stripe CLI for local webhook testing

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stripe Webhook Local Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Stripe CLI is already installed
Write-Host "Checking if Stripe CLI is installed..." -ForegroundColor Yellow
try {
    $stripeVersion = stripe --version 2>&1
    Write-Host "Stripe CLI is already installed: $stripeVersion" -ForegroundColor Green
    $stripeInstalled = $true
} catch {
    Write-Host "Stripe CLI is not installed" -ForegroundColor Red
    $stripeInstalled = $false
}

if (-not $stripeInstalled) {
    Write-Host ""
    Write-Host "Installing Stripe CLI..." -ForegroundColor Yellow
    
    # Check for Scoop
    $scoopInstalled = Get-Command scoop -ErrorAction SilentlyContinue
    if ($scoopInstalled) {
        Write-Host "Found Scoop package manager. Installing via Scoop..." -ForegroundColor Green
        scoop install stripe
    } else {
        Write-Host ""
        Write-Host "Scoop not found. Manual installation required." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please choose an installation method:" -ForegroundColor Cyan
        Write-Host "1. Install Scoop (recommended):" -ForegroundColor White
        Write-Host "   Run: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Gray
        Write-Host "   Then: irm get.scoop.sh | iex" -ForegroundColor Gray
        Write-Host "   Then: scoop install stripe" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Download manually:" -ForegroundColor White
        Write-Host "   Visit: https://github.com/stripe/stripe-cli/releases/latest" -ForegroundColor Gray
        Write-Host "   Download stripe_X.X.X_windows_x86_64.zip" -ForegroundColor Gray
        Write-Host "   Extract and add to PATH" -ForegroundColor Gray
        Write-Host ""
        Write-Host "After installation, run this script again." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Login to Stripe CLI" -ForegroundColor Yellow
Write-Host '   stripe login' -ForegroundColor White
Write-Host ""
Write-Host "2. Start webhook forwarding (in a separate terminal)" -ForegroundColor Yellow
Write-Host '   npm run stripe:listen' -ForegroundColor White
Write-Host "   (This will output a webhook secret - copy it!)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Add webhook secret to .env.local" -ForegroundColor Yellow
Write-Host '   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx' -ForegroundColor White
Write-Host ""
Write-Host "4. Make sure your .env.local has these variables" -ForegroundColor Yellow
Write-Host '   STRIPE_SECRET_KEY=sk_test_...' -ForegroundColor White
Write-Host '   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...' -ForegroundColor White
Write-Host '   STRIPE_WEBHOOK_SECRET=whsec_...' -ForegroundColor White
Write-Host '   NEXT_PUBLIC_APP_URL=http://localhost:3010' -ForegroundColor White
Write-Host ""
Write-Host "5. Start your dev server" -ForegroundColor Yellow
Write-Host '   npm run dev' -ForegroundColor White
Write-Host ""
Write-Host "6. Test webhooks" -ForegroundColor Yellow
Write-Host '   npm run stripe:trigger checkout.session.completed' -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see: docs/STRIPE_WEBHOOK_LOCAL_TESTING.md" -ForegroundColor Cyan
Write-Host ""
