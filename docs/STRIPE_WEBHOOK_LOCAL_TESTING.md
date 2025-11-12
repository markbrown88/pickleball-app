# Stripe Webhook Local Testing Guide

This guide explains how to test Stripe webhooks locally during development.

## Why You Need This

Stripe webhooks require a publicly accessible URL to send events to your application. Your local development server (`localhost:3010`) is not accessible from the internet, so you need a tool to forward Stripe's webhook calls to your local server.

## Option 1: Stripe CLI (Recommended) ⭐

Stripe CLI is the official tool designed specifically for testing Stripe webhooks locally. It's simpler and more reliable than ngrok for Stripe-specific testing.

### Installation

**Windows (PowerShell):**
```powershell
# Using Scoop (if you have it)
scoop install stripe

# Or download from: https://github.com/stripe/stripe-cli/releases
# Extract and add to PATH
```

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Download from: https://github.com/stripe/stripe-cli/releases
# Or use package manager
```

### Setup Steps

1. **Login to Stripe CLI:**
   ```bash
   stripe login
   ```
   This will open your browser to authenticate with your Stripe account.

2. **Start your local dev server:**
   ```bash
   npm run dev
   ```
   Your server should be running on `http://localhost:3010`

3. **Forward webhooks to your local server:**
   ```bash
   stripe listen --forward-to localhost:3010/api/webhooks/stripe
   ```

4. **Copy the webhook signing secret:**
   When you run `stripe listen`, it will output something like:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
   ```
   
   **Important:** Copy this secret and add it to your `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```
   
   ⚠️ **Note:** This secret is different from your production webhook secret. It's only for local testing.

5. **Restart your dev server** after adding the webhook secret so it picks up the new environment variable.

6. **Trigger test events:**
   ```bash
   # Test checkout session completed
   stripe trigger checkout.session.completed
   
   # Test payment intent succeeded
   stripe trigger payment_intent.succeeded
   
   # Test payment intent failed
   stripe trigger payment_intent.payment_failed
   
   # Test charge refunded
   stripe trigger charge.refunded
   ```

### Using npm Scripts (Easier)

We've added npm scripts to make this easier. After installing Stripe CLI:

```bash
# Start webhook forwarding (in a separate terminal)
npm run stripe:listen

# Trigger test events
npm run stripe:trigger checkout.session.completed
npm run stripe:trigger payment_intent.succeeded
```

## Option 2: ngrok

If you prefer ngrok or need a persistent public URL:

### Installation

**Windows:**
```powershell
# Using Scoop
scoop install ngrok

# Or download from: https://ngrok.com/download
```

**macOS:**
```bash
brew install ngrok
```

**Linux:**
```bash
# Download from: https://ngrok.com/download
```

### Setup Steps

1. **Sign up for ngrok:** https://ngrok.com (free account works)

2. **Get your authtoken** from the ngrok dashboard

3. **Configure ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

4. **Start your local dev server:**
   ```bash
   npm run dev
   ```

5. **Start ngrok tunnel:**
   ```bash
   ngrok http 3010
   ```

6. **Copy the forwarding URL:**
   ngrok will show something like:
   ```
   Forwarding  https://abc123.ngrok.io -> http://localhost:3010
   ```

7. **Configure webhook in Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://abc123.ngrok.io/api/webhooks/stripe`
   - Select events:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
   - Click "Add endpoint"

8. **Copy the webhook signing secret:**
   - After creating the endpoint, Stripe will show a signing secret (starts with `whsec_`)
   - Add it to your `.env.local`:
     ```env
     STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
     ```

9. **Restart your dev server**

10. **Test:** Make a test payment and watch your server logs for webhook events

⚠️ **Note:** The ngrok URL changes every time you restart ngrok (unless you have a paid plan). You'll need to update the webhook URL in Stripe Dashboard each time.

## Testing Your Webhooks

### Method 1: Stripe CLI Trigger (Easiest)

```bash
# Trigger specific events
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

### Method 2: Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select an event type
5. Click "Send test webhook"

### Method 3: Make a Real Test Payment

1. Use Stripe test card: `4242 4242 4242 4242`
2. Any future expiry date (e.g., `12/34`)
3. Any 3-digit CVC (e.g., `123`)
4. Complete checkout
5. Watch your server logs for webhook events

## Troubleshooting

### Webhook signature verification failed

**Problem:** You see `Webhook signature verification failed` in logs

**Solution:**
- Make sure `STRIPE_WEBHOOK_SECRET` is set correctly in `.env.local`
- If using Stripe CLI, use the secret from `stripe listen` output
- If using ngrok, use the secret from Stripe Dashboard
- Restart your dev server after changing the secret

### Webhook not received

**Problem:** Events aren't reaching your server

**Solution:**
- Check that `stripe listen` or `ngrok` is running
- Verify the forwarding URL is correct
- Check your server logs for errors
- Make sure your dev server is running on port 3010
- Check firewall/antivirus isn't blocking connections

### 404 Not Found

**Problem:** Stripe returns 404 when sending webhooks

**Solution:**
- Verify the endpoint URL: `/api/webhooks/stripe`
- Make sure your Next.js dev server is running
- Check that the route file exists: `src/app/api/webhooks/stripe/route.ts`

### Wrong webhook secret

**Problem:** Using production webhook secret for local testing

**Solution:**
- Local testing requires a different secret
- Stripe CLI provides its own secret (`whsec_...`)
- ngrok + Stripe Dashboard provides a test webhook secret
- Never use production secrets for local development

## Environment Variables

Make sure your `.env.local` has:

```env
# Stripe API Keys (use test keys for local dev)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook Secret (from Stripe CLI or Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL (for redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

## Production Setup

For production, you don't need Stripe CLI or ngrok:

1. Deploy your app (e.g., to Vercel)
2. Go to Stripe Dashboard → Webhooks
3. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
4. Select events
5. Copy the webhook signing secret
6. Add to production environment variables

## Quick Reference

### Stripe CLI Commands

```bash
# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3010/api/webhooks/stripe

# Trigger events
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded

# View events
stripe events list
```

### ngrok Commands

```bash
# Start tunnel
ngrok http 3010

# View dashboard
# Open http://localhost:4040 in browser
```

## Next Steps

Once webhooks are working locally:

1. Test all event types
2. Verify database updates are correct
3. Test error handling
4. Deploy to staging/production
5. Configure production webhook endpoint

