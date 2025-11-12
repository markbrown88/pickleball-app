# API 404 Error Fix

## Problem
The `/manager` page is showing 404 errors for these API endpoints:
- `/api/admin/stops/[stopId]/fix-bracket` (POST)
- `/api/admin/matches/[matchId]/complete` (POST)

The errors show HTML 404 pages instead of JSON responses, indicating Next.js cannot find the routes.

## ✅ Root Cause Identified
The API routes **DO EXIST** in the codebase:
- ✅ `src/app/api/admin/stops/[stopId]/fix-bracket/route.ts`
- ✅ `src/app/api/admin/matches/[matchId]/complete/route.ts`

**But** Next.js development server is not recognizing them because:
1. The routes were created while the dev server was running
2. Next.js cached the old route structure
3. The server needs to restart to pick up new routes

## 🔧 Solution (Choose One)

### Option 1: Use the Restart Script (Recommended)
I've created a script that handles everything:

```bash
# Windows
restart-dev.bat

# This will:
# 1. Stop any running dev servers
# 2. Clear the .next cache
# 3. Restart the dev server
```

### Option 2: Manual Steps
```bash
# 1. Stop the dev server (Ctrl+C in the terminal)

# 2. Kill any lingering Node processes
taskkill /F /IM node.exe /T

# 3. Clear Next.js cache
rm -rf .next

# 4. Restart
npm run dev
```

## 🧪 Verification

### Step 1: Test the API Routes
After restarting, run the test script:

```bash
node test-api-routes.js
```

This will check if the routes are responding with JSON (✅ working) or HTML 404 pages (❌ still broken).

**Expected output if working:**
```
✅ Response is JSON (route is working)
✅ Passed: 2/2
```

**If you see 404 HTML pages:**
```
❌ Got 404 HTML page - Route not found by Next.js
Solution: Restart the development server
```

### Step 2: Test in Browser
1. Go to `/manager` page
2. Select a **DE Clubs** tournament stop
3. The bracket should load without errors
4. Open browser console - should see:
   - `✅ [CLEANUP] Fixed X incorrect loser bracket placements`
   - No red error messages about "Failed to fetch"

### Step 3: Test Match Completion
1. On the bracket manager, click any match
2. Enter scores and click "Complete Match"
3. Should see success message
4. Bracket should update with winner advanced

## API Routes That Should Work

- ✅ `POST /api/admin/stops/[stopId]/fix-bracket` - Fixes bracket placement errors
- ✅ `POST /api/admin/matches/[matchId]/complete` - Marks match as complete

Both routes exist and have proper `async function POST()` exports.

## Common Issues

### Issue: Still getting 404 after restart
**Solution**: Clear `.next` folder and restart

### Issue: TypeScript compilation errors
**Solution**: Run `npm run type-check` and fix any errors

### Issue: Routes work for some URLs but not others
**Solution**: Check that the parameter names match (e.g., `[matchId]` not `[id]`)

## Notes

- The Stripe payment routes were recently added and work fine
- The bracket manager routes should work the same way
- This is a development server caching issue, not a code issue
