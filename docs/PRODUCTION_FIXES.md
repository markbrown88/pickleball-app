# Production Environment Fixes

This document outlines the issues found in the production deployment and their solutions.

## Issues Found

### 1. Content Security Policy (CSP) - Clerk Script Loading ✅ FIXED

**Error:**
```
Refused to load the script 'https://suitable-gull-60.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js'
because it violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'
https://clerk.com https://*.clerk.com"
```

**Root Cause:**
The CSP `script-src` directive only allowed `clerk.com` and `*.clerk.com` domains, but Clerk was trying to load from `clerk.accounts.dev`.

**Fix Applied:**
Updated [next.config.ts:48,52](../next.config.ts#L48) to add `https://*.clerk.accounts.dev` to both `script-src` and `connect-src` directives.

**Before:**
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com"
"connect-src 'self' https://clerk.com https://*.clerk.com https://*.supabase.com https://*.upstash.io"
```

**After:**
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev"
"connect-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://*.supabase.com https://*.upstash.io"
```

---

### 2. Content Security Policy (CSP) - Web Workers ✅ FIXED

**Error:**
```
Refused to create a worker from 'blob:https://klyngcup.com/d7cd5125-2d72-4287-b618-daf576cabe8d'
because it violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'
https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev". Note that 'worker-src' was not explicitly set,
so 'script-src' is used as a fallback.
```

**Root Cause:**
Clerk needs to create Web Workers from blob URLs for its internal operations, but the CSP didn't have a `worker-src` directive, causing it to fall back to `script-src` which didn't allow `blob:` sources.

**Fix Applied:**
Added `worker-src` directive to [next.config.ts:53](../next.config.ts#L53):

```typescript
"worker-src 'self' blob:"
```

This allows Web Workers from same-origin and blob URLs while maintaining security.

---

### 3. Clerk Development Keys in Production ⚠️ ACTION REQUIRED

**Warning:**
```
Clerk: Clerk has been loaded with development keys. Development instances have strict usage limits and should
not be used when deploying your application to production.
```

**Root Cause:**
The `.env.local` file contains test keys:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
- `CLERK_SECRET_KEY=sk_test_...`

These are development/test keys (indicated by `pk_test_` and `sk_test_` prefixes) and should **NEVER** be used in production.

**ACTION REQUIRED:**

1. **Create a Production Instance in Clerk:**
   - Go to https://dashboard.clerk.com
   - Create a new Production instance (or switch your existing instance to Production mode)
   - Get your production keys (they will start with `pk_live_` and `sk_live_`)

2. **Update Environment Variables:**
   - In your production hosting platform (Vercel, etc.), update the environment variables:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → Use the `pk_live_...` key
     - `CLERK_SECRET_KEY` → Use the `sk_live_...` key

3. **Configure Production Settings:**
   - Set your production domain in Clerk dashboard
   - Configure allowed redirect URLs
   - Review and adjust rate limits for production use

4. **Security Note:**
   - **NEVER commit production keys to git**
   - Keep `.env.local` in `.gitignore`
   - Use environment variables in your hosting platform

**Development vs Production Keys:**

| Environment | Publishable Key Prefix | Secret Key Prefix | Use Case |
|-------------|----------------------|-------------------|----------|
| Development | `pk_test_` | `sk_test_` | Local development only |
| Production | `pk_live_` | `sk_live_` | Production deployments |

---

### 4. API 500 Errors - Match Games Endpoint ⚠️ NEEDS INVESTIGATION

**Error:**
```
GET https://klyngcup.com/api/admin/matches/{matchId}/games 500 (Internal Server Error)
```

**Observed Behavior:**
Multiple 500 errors from the `/api/admin/matches/[matchId]/games` endpoint when loading the /manager page.

**Code Review:**
The endpoint code in [src/app/api/admin/matches/[matchId]/games/route.ts](../src/app/api/admin/matches/[matchId]/games/route.ts) looks correct and has proper error handling.

**Possible Causes:**
1. **Database Connection Issues:**
   - Check if DATABASE_URL is correctly configured in production
   - Verify Supabase database is accessible from production environment
   - Check connection pool limits

2. **Missing Match Data:**
   - The match IDs being requested might not exist in production database
   - There might be a data synchronization issue between environments

3. **Prisma Client Issues:**
   - Prisma client might not be properly generated in production
   - Schema mismatch between code and database

**Debugging Steps:**

1. **Check Production Logs:**
   ```bash
   # If using Vercel
   vercel logs

   # Look for the actual error from the console.error in route.ts
   ```

2. **Verify Database Connection:**
   ```bash
   # Test database connectivity
   npx prisma db pull --preview-feature
   ```

3. **Check Match IDs:**
   - Verify the match IDs (`cmgmcthmk000or02cldh20uqr`, `cmgmcthmk000pr02c1uqagnim`) exist in production database
   - Check if these are test data IDs that don't exist in production

4. **Review Prisma Setup:**
   ```bash
   # Ensure Prisma client is generated
   npx prisma generate

   # Rebuild the application
   npm run build
   ```

**Recommended Fix:**
Once the specific error is identified from production logs, we can implement a proper fix. The error handling is already in place, but we need the specific error message to diagnose further.

---

### 5. Deprecated Clerk Props ⚠️ ACTION REQUIRED (Clerk Dashboard)

**Warning:**
```
Clerk: The prop "afterSignInUrl" is deprecated and should be replaced with the new "fallbackRedirectUrl"
or "forceRedirectUrl" props instead.
```

**Root Cause:**
The `afterSignInUrl` property is **NOT in your source code** - it's configured in your **Clerk Dashboard** settings. This is a dashboard configuration issue, not a code issue.

**Fix Required:**

1. **Log in to Clerk Dashboard:**
   - Go to https://dashboard.clerk.com
   - Select your production instance

2. **Update Redirect Settings:**
   - Navigate to **Paths** section in the sidebar
   - Look for "After sign in URL" or "After sign up URL" settings
   - These settings use the deprecated configuration
   - Update to use the new redirect strategy (or leave blank to use default behavior)

3. **Alternative - Clear Dashboard Redirects:**
   - If you don't need custom redirects, simply remove these values from the dashboard
   - Clerk will use intelligent defaults based on where the user initiated sign-in

**Note:** No code changes are needed. This warning comes from Clerk's internal configuration when it detects dashboard settings using the old redirect format.

---

## Deployment Checklist

Before deploying to production:

- [x] Update CSP to allow `clerk.accounts.dev`
- [x] Add `worker-src` directive for Web Workers
- [ ] **Replace Clerk test keys with production keys**
- [ ] Investigate and fix 500 errors from match games endpoint
- [ ] Replace deprecated `afterSignInUrl` props
- [ ] Test all critical flows (sign in, /manager page, match management)
- [ ] Monitor production logs for any new errors
- [ ] Set up proper error tracking (Sentry, etc.)

---

## Immediate Next Steps

1. **CRITICAL - Update Clerk Keys:**
   - This is blocking proper production use
   - Follow instructions in section 3 above

2. **Debug 500 Errors:**
   - Check production logs
   - Verify database connectivity
   - Test the /manager page with real data

3. **Rebuild and Deploy:**
   ```bash
   npm run build
   # Deploy to production
   ```

4. **Verify Fixes:**
   - Open browser console on production site
   - Navigate to /manager page
   - Confirm CSP errors are resolved
   - Check if 500 errors persist

---

## Additional Production Recommendations

1. **Environment Variables:**
   - Use proper environment variable management in your hosting platform
   - Never commit secrets to git
   - Use different databases for dev/staging/production

2. **Error Monitoring:**
   - Set up Sentry or similar for production error tracking
   - Configure alerts for 500 errors
   - Monitor Clerk authentication issues

3. **Performance:**
   - Enable Redis caching (you already have REDIS_URL configured)
   - Monitor API response times
   - Consider implementing request rate limiting

4. **Security:**
   - Keep CSP directives as strict as possible
   - Regular security audits
   - Monitor for suspicious activity

---

## Files Modified

- [next.config.ts](../next.config.ts) - Updated CSP headers (lines 48, 52, 53)

## Files to Check

- Any file using `afterSignInUrl` prop
- `.env` files in production environment (update Clerk keys)
- Production logs for 500 error details
