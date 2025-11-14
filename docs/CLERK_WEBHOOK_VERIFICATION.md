# Clerk Webhook Verification Checklist

This guide helps you verify that Clerk webhooks are properly configured to automatically create Player records when new users sign up.

## ✅ Step 1: Verify Webhook Endpoint in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Webhooks** in the left sidebar
4. Check if you have a webhook endpoint configured:
   - **Endpoint URL should be:** `https://klyngcup.com/api/webhooks/clerk`
   - **Subscribed events:** Must include `user.created`
   - **Status:** Should be "Active" (green)

### If webhook doesn't exist:
1. Click **"Add Endpoint"**
2. Enter endpoint URL: `https://klyngcup.com/api/webhooks/clerk`
3. Subscribe to event: **`user.created`** (check the box)
4. Click **"Create"**
5. **Copy the signing secret** (starts with `whsec_`) - you'll need this for Step 2

## ✅ Step 2: Verify Webhook Secret in Vercel

1. Go to your [Vercel Project](https://vercel.com)
2. Navigate to **Settings** → **Environment Variables**
3. Check if `CLERK_WEBHOOK_SECRET` exists:
   - **Name:** `CLERK_WEBHOOK_SECRET`
   - **Value:** Should start with `whsec_`
   - **Environment:** Should be set for **Production** (and optionally Preview/Development)

### If secret doesn't exist or is wrong:
1. Go back to Clerk Dashboard → Webhooks → Your endpoint
2. Click on the endpoint to view details
3. Find the **"Signing Secret"** section
4. Click **"Reveal"** or **"Copy"** to get the secret
5. In Vercel, add/edit the environment variable:
   - **Key:** `CLERK_WEBHOOK_SECRET`
   - **Value:** Paste the secret (should start with `whsec_`)
   - **Environment:** Select **Production** (and others if needed)
6. **Redeploy** your application after adding/updating the secret

## ✅ Step 3: Verify Webhook Route is Public

The webhook route must be accessible without authentication. Verify in `src/middleware.ts`:

```typescript
const isPublicRoute = createRouteMatcher([
  "/", "/captain(.*)", "/stop(.*)", "/tournament(.*)", "/api/tournaments", 
  "/api/public(.*)", "/api/captain-portal(.*)", "/api/ping", 
  "/sign-in(.*)", "/sign-up(.*)", 
  "/api/webhooks(.*)"  // ← This line ensures webhooks are public
]);
```

✅ **This is already configured correctly** - `/api/webhooks(.*)` is in the public routes.

## ✅ Step 4: Test the Webhook

### Option A: Check Recent Webhook Deliveries in Clerk

1. Go to Clerk Dashboard → Webhooks → Your endpoint
2. Click on **"Recent Deliveries"** tab
3. Look for recent `user.created` events
4. Check the **Status** column:
   - ✅ **200** = Success (webhook is working!)
   - ❌ **400** = Invalid signature (check webhook secret)
   - ❌ **500** = Server error (check Vercel logs)
   - ❌ **Failed** = Endpoint unreachable (check URL)

### Option B: Test with a New Signup

1. Create a test account with a new email address
2. Sign up at `https://klyngcup.com/sign-up`
3. Check Vercel logs (Deployments → Your deployment → Functions → `/api/webhooks/clerk`)
4. Look for logs like:
   ```
   Processing user.created webhook: { clerkUserId: '...', email: '...', ... }
   Creating new Player record for Clerk user
   Successfully created new Player record: cmxxx... with club: cmxxx...
   ```
5. Verify in database that a Player record was created with the new email

## ✅ Step 5: Verify Player Creation

After a new user signs up, verify:

1. **Check database:**
   ```sql
   SELECT id, email, "clerkUserId", name, "clubId" 
   FROM "Player" 
   WHERE email = 'test@example.com';
   ```
   - Should have a `clerkUserId` (starts with `user_`)
   - Should have a `clubId` (assigned to first club alphabetically)
   - Should have the email address

2. **Check Vercel Function Logs:**
   - Go to Vercel → Your Project → Deployments → Latest → Functions
   - Find `/api/webhooks/clerk` function
   - Check logs for any errors

## 🔧 Troubleshooting

### Webhook Not Firing

**Symptoms:** No webhook deliveries in Clerk Dashboard

**Solutions:**
1. Verify endpoint URL is correct: `https://klyngcup.com/api/webhooks/clerk`
2. Check that the endpoint is **Active** in Clerk Dashboard
3. Ensure `user.created` event is subscribed
4. Try clicking **"Send test event"** in Clerk Dashboard

### Invalid Signature Error

**Symptoms:** Webhook deliveries show 400 status with "Invalid signature"

**Solutions:**
1. Verify `CLERK_WEBHOOK_SECRET` in Vercel matches the secret in Clerk Dashboard
2. Ensure no extra spaces or newlines in the environment variable
3. Redeploy after updating the secret
4. Check that you're using the correct secret for the correct endpoint

### Player Not Created

**Symptoms:** Webhook succeeds (200) but no Player record exists

**Solutions:**
1. Check Vercel function logs for errors
2. Verify database connection is working
3. Check if there are any clubs in the database (required for Player creation)
4. Look for error messages in logs about missing clubs

### Webhook Returns 500 Error

**Symptoms:** Webhook deliveries show 500 status

**Solutions:**
1. Check Vercel function logs for detailed error messages
2. Verify database connection
3. Check that at least one Club exists in the database
4. Look for Prisma errors in logs

## 📋 Quick Checklist Summary

- [ ] Webhook endpoint exists in Clerk Dashboard
- [ ] Endpoint URL: `https://klyngcup.com/api/webhooks/clerk`
- [ ] `user.created` event is subscribed
- [ ] Endpoint status is "Active"
- [ ] `CLERK_WEBHOOK_SECRET` exists in Vercel environment variables
- [ ] Secret value matches Clerk Dashboard (starts with `whsec_`)
- [ ] Application has been redeployed after setting secret
- [ ] At least one Club exists in database
- [ ] Test signup creates Player record successfully

## 🎯 Expected Behavior

When a new user signs up with Clerk:

1. ✅ Clerk sends `user.created` webhook to `/api/webhooks/clerk`
2. ✅ Webhook handler verifies signature
3. ✅ Handler checks for existing Player with that email
4. ✅ If no Player exists, creates new Player record with:
   - Clerk User ID
   - Email address
   - First/Last name (if provided by Clerk)
   - Default gender: MALE
   - Default country: Canada
   - Default club: First club alphabetically
5. ✅ Returns success response (200)
6. ✅ User can now log in and see their Player profile

## 📞 Need Help?

If webhooks still aren't working after following this checklist:

1. Check Vercel function logs for detailed error messages
2. Check Clerk Dashboard → Webhooks → Recent Deliveries for error details
3. Verify database connectivity
4. Ensure at least one Club exists in the database

