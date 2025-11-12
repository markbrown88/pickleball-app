# Quick Start Guide for Stripe Webhook Testing

## Prerequisites Check

Run this script to check your setup:
```powershell
.\setup-stripe-webhooks.ps1
```

## Manual Setup Steps

### Step 1: Install Stripe CLI

**Option A: Using Scoop (Easiest)**
```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Stripe CLI
scoop install stripe
```

**Option B: Manual Download**
1. Visit: https://github.com/stripe/stripe-cli/releases/latest
2. Download `stripe_X.X.X_windows_x86_64.zip`
3. Extract to a folder (e.g., `C:\stripe-cli`)
4. Add to PATH:
   - Open System Properties → Environment Variables
   - Add `C:\stripe-cli` to PATH
   - Restart terminal

### Step 2: Login to Stripe
```powershell
stripe login
```
This opens your browser to authenticate.

### Step 3: Create .env.local (if it doesn't exist)

Create `.env.local` in the project root with:
```env
# Stripe API Keys (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook Secret (you'll get this from Step 4)
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

### Step 4: Start Webhook Forwarding

Open a **new terminal** and run:
```powershell
npm run stripe:listen
```

You'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy this secret** and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### Step 5: Start Your Dev Server

In your main terminal:
```powershell
npm run dev
```

### Step 6: Test Webhooks

In another terminal, trigger test events:
```powershell
npm run stripe:trigger checkout.session.completed
npm run stripe:trigger payment_intent.succeeded
npm run stripe:trigger payment_intent.payment_failed
```

Watch your dev server logs to see webhook events being received!

## Troubleshooting

**"stripe: command not found"**
- Make sure Stripe CLI is installed and in your PATH
- Restart your terminal after installation

**"Webhook signature verification failed"**
- Make sure `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the secret from `stripe listen`
- Restart your dev server after updating `.env.local`

**Webhooks not received**
- Make sure `stripe listen` is running
- Check that your dev server is running on port 3010
- Verify the endpoint URL in `stripe listen` output

## What's Running?

You need **3 terminals** running simultaneously:

1. **Terminal 1**: `npm run stripe:listen` (webhook forwarding)
2. **Terminal 2**: `npm run dev` (your Next.js server)
3. **Terminal 3**: `npm run stripe:trigger <event>` (testing)

## Need Help?

See the full guide: `docs/STRIPE_WEBHOOK_LOCAL_TESTING.md`

