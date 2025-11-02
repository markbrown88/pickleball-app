# Clerk Webhook Setup

This document explains how to configure Clerk webhooks to automatically link existing Player records to new Clerk accounts.

## Problem Being Solved

Many players in the database have emails that were manually entered (they don't have Clerk accounts yet). When these players sign up with Clerk using their existing email, we want to:
1. Link their Clerk account to the existing Player record
2. Avoid creating duplicate Player records
3. Preserve all their existing tournament registrations, team memberships, etc.

## How It Works

When a new user signs up with Clerk:
1. Clerk sends a `user.created` webhook event to `/api/webhooks/clerk`
2. The webhook handler checks if a Player record exists with that email (but no `clerkUserId`)
3. If found, it links the Clerk account by updating the Player's `clerkUserId` field
4. If not found, the normal auth flow will create a new Player record

## Setup Instructions

### 1. Add Webhook Secret to Environment Variables

First, you need to get the webhook signing secret from Clerk and add it to your environment variables.

**In `.env.local` (for local development):**
```bash
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**In Vercel (for production):**
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add `CLERK_WEBHOOK_SECRET` with the value from Clerk (see step 2 below)

### 2. Configure Webhook in Clerk Dashboard

1. **Go to Clerk Dashboard:**
   - Visit https://dashboard.clerk.com
   - Select your application

2. **Navigate to Webhooks:**
   - In the left sidebar, click "Webhooks"
   - Click "Add Endpoint"

3. **Configure the Endpoint:**

   **For Local Development (using ngrok or similar):**
   - Endpoint URL: `https://your-ngrok-url.ngrok.io/api/webhooks/clerk`
   - Subscribe to events: Check `user.created`
   - Click "Create"

   **For Production (Vercel):**
   - Endpoint URL: `https://your-domain.com/api/webhooks/clerk`
   - Subscribe to events: Check `user.created`
   - Click "Create"

4. **Copy the Signing Secret:**
   - After creating the endpoint, Clerk will show you a signing secret (starts with `whsec_`)
   - Copy this secret
   - Add it to your environment variables as shown in step 1

### 3. Test the Webhook

#### Option A: Test Locally with ngrok

1. **Start ngrok:**
   ```bash
   ngrok http 3010
   ```

2. **Update Clerk webhook URL:**
   - Use the ngrok URL: `https://YOUR-NGROK-ID.ngrok.io/api/webhooks/clerk`

3. **Test signup:**
   - Find a Player record in your database that has an email but no `clerkUserId`
   - Go to your app's signup page
   - Sign up with that email
   - Check the server logs to see:
     ```
     Processing user.created webhook: { clerkUserId: '...', email: '...', ... }
     Found existing Player record without Clerk account: cmfpzuh3r...
     Successfully linked Clerk account to existing Player: cmfpzuh3r...
     ```

4. **Verify in database:**
   - Check that the Player record now has a `clerkUserId`
   - Verify the user can log in and see their existing registrations

#### Option B: Test in Production

1. **Deploy to Vercel** with the webhook secret configured
2. **Update Clerk webhook URL** to your production domain
3. **Test signup** with an existing email from your database

### 4. Monitor Webhook Activity

1. In Clerk Dashboard → Webhooks, click on your endpoint
2. View the "Recent Deliveries" tab to see webhook attempts
3. Check for successful responses (200 status code)
4. If there are errors, view the webhook payload and error details

## Webhook Response Codes

The webhook returns different responses based on the scenario:

| Status | Scenario | Response Body |
|--------|----------|---------------|
| 200 | Existing Player found and linked | `{ success: true, action: 'linked', playerId: '...', clerkUserId: '...' }` |
| 200 | No existing Player found (new user) | `{ success: true, action: 'none', message: 'No existing player found...' }` |
| 200 | Other webhook events (acknowledged) | `{ success: true, eventType: '...' }` |
| 400 | Missing Svix headers | `{ error: 'Missing svix headers' }` |
| 400 | Invalid signature | `{ error: 'Invalid signature' }` |
| 400 | No primary email found | `{ error: 'No primary email found' }` |
| 500 | Webhook secret not configured | `{ error: 'Webhook secret not configured' }` |
| 500 | Internal server error | `{ error: 'Internal server error' }` |

## Troubleshooting

### Webhook Secret Not Working

**Symptom:** `Invalid signature` errors in Clerk dashboard

**Solution:**
1. Make sure you copied the entire secret including the `whsec_` prefix
2. Ensure there are no extra spaces or newlines in the environment variable
3. Restart your dev server after adding the secret
4. Verify the secret is loaded: `console.log(process.env.CLERK_WEBHOOK_SECRET)`

### Webhook Not Receiving Events

**Symptom:** No logs appear when signing up

**Solution:**
1. Verify the endpoint URL is correct in Clerk dashboard
2. Check that `/api/webhooks(.*)` is in the public routes in `src/middleware.ts`
3. Test the endpoint manually with curl:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/clerk \
     -H "Content-Type: application/json"
   ```
   (This will fail signature verification but confirms the endpoint is reachable)

### Player Not Being Linked

**Symptom:** Webhook succeeds but Player doesn't have `clerkUserId`

**Solution:**
1. Check server logs for errors
2. Verify the email in Clerk exactly matches the email in the database (case-insensitive)
3. Ensure the existing Player record has `clerkUserId: null`
4. Check database permissions

### Multiple Player Records Created

**Symptom:** Both an old record and a new record exist

**Solution:**
1. This might happen if the webhook wasn't set up before the user signed up
2. Use the "Merge Player Profiles" feature in the App Admin panel to consolidate them:
   - Go to `/app-admin/merge-players`
   - Select the two records
   - Merge them (the old record will be preserved, new one disabled)

## Future Considerations

This webhook is intended as a **temporary solution** for the transition period where many manually-entered players are signing up for the first time.

**Long-term:**
- Once most players have Clerk accounts, this linking logic becomes less critical
- Consider adding admin reports to track:
  - How many players still don't have Clerk accounts
  - How many successful linkages have occurred
- Eventually, you may want to disable email-based linking once the migration is complete

## Security Notes

- The webhook verifies the signature using Svix to ensure requests are genuinely from Clerk
- Never expose the webhook secret publicly
- The webhook is public (doesn't require authentication) because Clerk needs to call it
- All database operations are done in a transaction for data integrity

## Related Files

- Webhook handler: `/src/app/api/webhooks/clerk/route.ts`
- Middleware config: `/src/middleware.ts`
- Merge players UI: `/src/app/app-admin/merge-players/page.tsx`
- Merge players API: `/src/app/api/app-admin/players/merge/route.ts`
