# "Decide by Points" and "Add Tiebreaker" Button Fixes

## Issues Fixed

### Issue 1: "Decide by Points" Button Does Nothing
**Problem:** Clicking the "Decide by Points" button appeared to do nothing.

**Root Cause:** The validation logic on line 2086 of EventManagerTab.tsx only accepted `'tied_requires_tiebreaker'` status but the button now also appears for `'needs_decision'` status (when total points are unequal). The validation was rejecting the `'needs_decision'` status, causing the function to exit early.

**Fix:** Updated the validation to accept both statuses:
```typescript
// OLD - BUGGY
if (derivedStatus !== 'tied_requires_tiebreaker') {
  onInfo('This match is not currently tied 2-2 on the standard games.');
  return;
}

// NEW - FIXED
if (derivedStatus !== 'tied_requires_tiebreaker' && derivedStatus !== 'needs_decision') {
  onInfo('This match is not currently in a state where it can be decided by points.');
  return;
}
```

**File:** `src/app/manager/components/EventManagerTab.tsx` (line ~2086)

---

### Issue 2: "Add Tiebreaker" Button Gives "Failed to save games" Error
**Problem:** Clicking "Add Tiebreaker" resulted in error: `{"error":"Failed to save games"}`

**Root Cause:** When trying to create a tiebreaker game, the code didn't check if one already existed. The database has a UNIQUE constraint on `(matchId, slot)`, so attempting to create a second TIEBREAKER game for the same match would fail with a unique constraint violation.

**Fix:** Added a check before creating the tiebreaker:
```typescript
// First check if tiebreaker already exists for this match
const existingTiebreaker = await prisma.game.findFirst({
  where: {
    matchId,
    slot: 'TIEBREAKER'
  }
});

if (existingTiebreaker) {
  // Tiebreaker already exists, just return it
  return NextResponse.json([existingTiebreaker]);
}

// Only create if it doesn't exist
const tiebreakerGame = await prisma.game.create({
  data: { ... }
});
```

**File:** `src/app/api/admin/matches/[matchId]/games/route.ts` (lines ~117-135)

---

## Database Constraint
The Game model has a unique constraint that prevents duplicate games:
```prisma
@@unique([matchId, slot], map: "Game_new_matchId_slot_key")
```

This means:
- ✅ One MENS_DOUBLES game per match
- ✅ One WOMENS_DOUBLES game per match
- ✅ One MIXED_1 game per match
- ✅ One MIXED_2 game per match
- ✅ **One TIEBREAKER game per match**

Attempting to create a second TIEBREAKER for the same match would violate this constraint.

---

## How It Should Work Now

### Clicking "Add Tiebreaker"
1. Checks if TIEBREAKER game already exists
2. If exists → Returns existing tiebreaker game (no error)
3. If not exists → Creates new TIEBREAKER game
4. Evaluates match status
5. Reloads page to show the tiebreaker

### Clicking "Decide by Points"
1. ✓ Validates match is in `'tied_requires_tiebreaker'` OR `'needs_decision'` state
2. Shows confirmation dialog
3. Sends PATCH request to decide match by total points
4. Updates match status to `'DECIDED_POINTS'`
5. Records winner and total points
6. Reloads page to show match is complete

---

## Files Modified
1. `src/app/manager/components/EventManagerTab.tsx`
   - Updated `resolveMatchByPoints` validation (line ~2086)
   
2. `src/app/api/admin/matches/[matchId]/games/route.ts`
   - Added tiebreaker existence check before creation (lines ~117-135)
   - Added error logging for debugging

---

## Result
✅ "Decide by Points" button now works when status is `'needs_decision'` (unequal points)
✅ "Add Tiebreaker" button works without unique constraint errors
✅ Idempotent: Clicking "Add Tiebreaker" multiple times returns the same game
✅ Both buttons properly update the manager page display
