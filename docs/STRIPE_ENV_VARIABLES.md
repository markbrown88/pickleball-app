# Stripe Environment Variables for Vercel

## Required Environment Variables

You need **3 Stripe-related environment variables** in Vercel:

### 1. `STRIPE_SECRET_KEY` (Required)
- **Purpose**: Server-side Stripe API key for creating checkout sessions and processing payments
- **Where to get it**: 
  - Stripe Dashboard → Developers → API keys
  - **Test mode**: `sk_test_...` (for development/testing)
  - **Production mode**: `sk_live_...` (for production)
- **Used in**: 
  - `src/lib/stripe/config.ts` - Initializes Stripe client
  - All payment API routes
- **Security**: Server-side only (never exposed to client)

### 2. `STRIPE_WEBHOOK_SECRET` (Required)
- **Purpose**: Webhook signature verification to ensure webhooks are from Stripe
- **Where to get it**: 
  - Stripe Dashboard → Developers → Webhooks
  - Click on your webhook endpoint
  - Copy the "Signing secret" (starts with `whsec_`)
  - **Important**: Each webhook endpoint has its own secret
  - **Test mode**: Use test webhook secret
  - **Production mode**: Use production webhook secret
- **Used in**: 
  - `src/app/api/webhooks/stripe/route.ts` - Verifies webhook signatures
- **Security**: Server-side only

### 3. `NEXT_PUBLIC_APP_URL` (Required for Stripe redirects)
- **Purpose**: Base URL for redirect URLs after payment (success/cancel pages)
- **Format**: `https://yourdomain.com` (no trailing slash)
- **Examples**:
  - Production: `https://klyngcup.com`
  - Preview: `https://your-app.vercel.app`
  - Local: `http://localhost:3010`
- **Used in**: 
  - `src/lib/stripe/config.ts` - Builds success/cancel URLs
  - `src/app/api/payments/create-checkout-session/route.ts` - Redirect URLs

## Optional (Not Currently Used)

### `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Not Required)
- **Status**: Not currently used in the codebase
- **Note**: If you add Stripe Elements or client-side Stripe features in the future, you'll need this
- **Where to get it**: Stripe Dashboard → Developers → API keys → Publishable key

## Summary

**Total Stripe-related variables needed: 3**

1. ✅ `STRIPE_SECRET_KEY` - Server-side API key
2. ✅ `STRIPE_WEBHOOK_SECRET` - Webhook signature secret
3. ✅ `NEXT_PUBLIC_APP_URL` - Base URL for redirects

## Setting Up in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Add each variable:
   - **Name**: `STRIPE_SECRET_KEY`
   - **Value**: `sk_test_...` (for test) or `sk_live_...` (for production)
   - **Environment**: Select Production, Preview, and/or Development as needed

   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: `whsec_...` (from Stripe Dashboard webhook endpoint)
   - **Environment**: Production (and Preview if you have preview webhooks)

   - **Name**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://yourdomain.com`
   - **Environment**: Production, Preview, Development

3. **Important Notes**:
   - Use **test keys** (`sk_test_`, `whsec_` from test webhook) for Preview/Development
   - Use **live keys** (`sk_live_`, `whsec_` from production webhook) for Production
   - The webhook secret **must match** the webhook endpoint in Stripe Dashboard
   - After adding/updating variables, redeploy or wait for next deployment

## Verifying Setup

After deployment, check:
1. Payment checkout sessions can be created (no errors in logs)
2. Webhook events are received successfully (check Stripe Dashboard → Webhooks → Events)
3. No "Invalid signature" errors in webhook logs

## Troubleshooting

### "Invalid signature" error
- **Cause**: `STRIPE_WEBHOOK_SECRET` doesn't match the webhook secret in Stripe Dashboard
- **Fix**: 
  1. Go to Stripe Dashboard → Webhooks → Your endpoint
  2. Copy the "Signing secret"
  3. Update `STRIPE_WEBHOOK_SECRET` in Vercel
  4. Redeploy

### "STRIPE_SECRET_KEY is not defined" error
- **Cause**: `STRIPE_SECRET_KEY` is missing or not set for the correct environment
- **Fix**: Add `STRIPE_SECRET_KEY` to Vercel environment variables

### Payment redirects to wrong URL
- **Cause**: `NEXT_PUBLIC_APP_URL` is incorrect
- **Fix**: Update `NEXT_PUBLIC_APP_URL` to match your actual domain

