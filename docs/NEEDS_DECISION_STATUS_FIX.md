# NEEDS_DECISION Status Bug Fix - Manager Page

## Issue Summary
When a match had all 4 games completed with a 2-2 tie, the "Decide by Points" and "Add Tiebreaker" buttons were not appearing on the `/manager` page, preventing event managers from resolving the match.

There were two scenarios where buttons didn't appear:
1. **No tiebreaker game yet + unequal points** → Status is `NEEDS_DECISION` but buttons didn't show
2. **Tiebreaker game already created + unequal points** → Status is `PENDING_TIEBREAKER` but buttons still didn't show

## Root Cause

### Problem 1: NEEDS_DECISION Status Not Mapped
The database correctly set `tiebreakerStatus = 'NEEDS_DECISION'` when:
- All 4 standard games complete
- Match tied 2-2
- Total points NOT equal

But the UI code incorrectly mapped it:
```typescript
case 'NEEDS_DECISION':
  return 'tied_pending';  // ❌ Wrong!
```

Then button check only looked for `'tied_requires_tiebreaker'`:
```typescript
{matchStatus === 'tied_requires_tiebreaker' && ... && (
  <button>Decide by Points</button>
)}
```

### Problem 2: PENDING_TIEBREAKER Status Excluded
When a tiebreaker game already exists, the status is `'PENDING_TIEBREAKER'` (normalizes to `'tied_pending'`). The user should still see options to "Decide by Points" instead if total points are unequal, but the buttons only checked for `'needs_decision'` status.

## How Tiebreaker Resolution Works

When all 4 games complete with a 2-2 tie:

### Scenario 1: Equal Total Points → No Tiebreaker Game Yet
- Database sets: `tiebreakerStatus = 'REQUIRES_TIEBREAKER'`
- UI displays: "Add Tiebreaker" button (must play tiebreaker)
- No "Decide by Points" button (points are equal)

### Scenario 2: Unequal Total Points → No Tiebreaker Game Yet  
- Database sets: `tiebreakerStatus = 'NEEDS_DECISION'`
- UI displays: 
  - **"Decide by Points"** button (winner determined by total points)
  - **"Add Tiebreaker"** button (alternative: play tiebreaker instead)

### Scenario 3: Tiebreaker Game Exists + Unequal Points
- Database sets: `tiebreakerStatus = 'PENDING_TIEBREAKER'`
- UI should display: 
  - **"Decide by Points"** button (abort tiebreaker, decide by points)
  - **"Add Tiebreaker"** button (continue with existing tiebreaker)

## The Fix

### 1. Added New Status Type
Added `'needs_decision'` to the `MatchStatus` union type:

```typescript
type MatchStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'tied_pending'
  | 'tied_requires_tiebreaker'
  | 'needs_decision'  // ✅ NEW
  | 'decided_points'
  | 'decided_tiebreaker';
```

### 2. Updated Status Normalization
Changed `normalizeTiebreakerStatus()` to properly map database status:

```typescript
const normalizeTiebreakerStatus = (status?: string | null): MatchStatus | null => {
  switch (status) {
    case 'NEEDS_DECISION':
      return 'needs_decision';  // ✅ Correct mapping
    case 'REQUIRES_TIEBREAKER':
      return 'tied_requires_tiebreaker';
    // ... other cases
  }
};
```

### 3. Updated Button Visibility - Include PENDING_TIEBREAKER
Extended button conditions to also show when status is `'tied_pending'` AND points disagree:

**"Decide by Points" Button:**
```typescript
{(matchStatus === 'needs_decision' || 
  (matchStatus === 'tied_pending' && totalPointsDisagree(...))) && (
  <button>Decide by Points</button>
)}
```

**"Add Tiebreaker" Button:**
```typescript
{(matchStatus === 'tied_requires_tiebreaker' || 
  matchStatus === 'needs_decision' || 
  (matchStatus === 'tied_pending' && totalPointsDisagree(...))) && (
  <button>Add Tiebreaker</button>
)}
```

## Files Modified
- `src/app/manager/components/EventManagerTab.tsx`
  - `MatchStatus` type definition (line ~902-910)
  - `normalizeTiebreakerStatus()` function (line ~910-931)
  - Button conditions for actions (line ~2566-2583)

## Result
✅ Event managers now see decision options whenever:
- All 4 games are complete
- Match is tied 2-2
- **Total points are unequal**

✅ Works in both scenarios:
- Before tiebreaker game exists (NEEDS_DECISION status)
- After tiebreaker game exists but not yet played (PENDING_TIEBREAKER status)

✅ Event managers can choose to either:
1. Resolve by total points (using "Decide by Points")
2. Play or continue a tiebreaker game (using "Add Tiebreaker")

## User Experience
**Before:** Buttons only showed in one scenario, not when tiebreaker game already existed
**After:** Buttons consistently show when points are unequal, giving full control to event managers

**Example - Pickleplex vs Pickleplex Oshawa (Test Tourney 17):**
- Games: 2-2 tie ✓
- Total Points: Unequal ✓
- **Result:** Both "Decide by Points" and "Add Tiebreaker" buttons now visible ✓
