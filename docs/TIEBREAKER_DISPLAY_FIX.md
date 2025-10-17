# Tiebreaker Display Bug Fix - Manager Page

## Issue Summary
Tiebreaker games were showing on the `/manager` page even when games hadn't started yet. The requirement is that tiebreaker games should only appear after all 4 standard games are completed and the database has evaluated whether a tiebreaker is actually needed.

## Root Cause
The manager page had **two conflicting sources of truth**:

1. **Database Source (Authoritative):** `match.tiebreakerStatus` 
   - Set by `evaluateMatchTiebreaker()` in `src/lib/matchTiebreaker.ts`
   - Only evaluates tiebreaker status when all 4 standard games are complete
   - Sets status to `'NONE'` when games aren't complete

2. **Local UI Calculation (Buggy):** Lines 2770-2779 in EventManagerTab
   - Was calculating if 4 games were complete with 2-2 win split
   - Showing tiebreaker prompts based on this **local calculation**, not database state
   - Could show tiebreakers before the database had finished evaluation

## How Tiebreaker Logic Works

### Database Evaluation (`evaluateMatchTiebreaker`)
```typescript
// Only evaluates when ALL 4 standard games are complete
if (completedStandardGames.length === STANDARD_SLOTS.length) {
  // Check wins (2-2 = tied)
  if (summary.winsA === 2 && summary.winsB === 2) {
    // 2-2 situation – evaluate totals or tiebreaker game
    if (tiebreaker exists) {
      // Tiebreaker game is already there
    } else if (totalPointsA === totalPointsB) {
      tiebreakerStatus = 'REQUIRES_TIEBREAKER'
    } else {
      tiebreakerStatus = 'NEEDS_DECISION'
    }
  }
} else {
  // Not all games complete yet
  tiebreakerStatus = 'NONE'
}
```

### Valid Tiebreaker Statuses (When Tiebreaker Should Show)
- **`REQUIRES_TIEBREAKER`** → All 4 games complete, 2-2 tied, equal total points → Show prompt to add tiebreaker game
- **`PENDING_TIEBREAKER`** → Tiebreaker game exists but not yet complete
- **`NEEDS_DECISION`** → All 4 games complete, 2-2 tied, but unequal total points → User needs to decide winner

## The Fix
Changed the tiebreaker display logic in EventManagerTab to:

1. **Remove local calculations** that tried to determine if a tiebreaker is needed
2. **Only use `match.tiebreakerStatus`** from the database
3. **Show tiebreaker prompt** only when: `tiebreakerStatus === 'REQUIRES_TIEBREAKER'`
4. **Show tiebreaker game** only when: `tiebreakerStatus === 'REQUIRES_TIEBREAKER'` OR `tiebreakerStatus === 'PENDING_TIEBREAKER'`

### Before (Buggy)
```typescript
const completedGames = games[match.id]?.filter((g) => g.slot !== 'TIEBREAKER' && g.isComplete) || [];
const teamAWins = completedGames.filter((g) => g.teamAScore > g.teamBScore).length;
const teamBWins = completedGames.filter((g) => g.teamBScore > g.teamAScore).length;
const resolvedTiebreakerStatus = normalizeTiebreakerStatus(match.tiebreakerStatus);
const needsTiebreaker =
  completedGames.length === 4 &&
  teamAWins === 2 &&
  teamBWins === 2 &&
  resolvedTiebreakerStatus === 'tied_requires_tiebreaker';  // ❌ Using both local calc AND db status

if (needsTiebreaker && !games[match.id]?.some((g) => g.slot === 'TIEBREAKER')) {
  // Show prompt
}

if (tiebreakerGame) {  // ❌ No check on tiebreakerStatus!
  // Show game
}
```

### After (Fixed)
```typescript
const resolvedTiebreakerStatus = normalizeTiebreakerStatus(match.tiebreakerStatus);

// Only show prompt if database says tiebreaker is required AND doesn't exist yet
const showTiebreakerPrompt = 
  resolvedTiebreakerStatus === 'tied_requires_tiebreaker' &&
  !games[match.id]?.some((g) => g.slot === 'TIEBREAKER');

if (showTiebreakerPrompt) {
  // Show prompt
}

// Only show tiebreaker game if database indicates it should be visible
if (tiebreakerGame && (resolvedTiebreakerStatus === 'tied_requires_tiebreaker' || resolvedTiebreakerStatus === 'tied_pending')) {
  // Show game
}
```

## Files Modified
- `src/app/manager/components/EventManagerTab.tsx` (lines ~2769-2806)

## Result
✅ Tiebreaker games now only appear when:
- All 4 standard games are complete
- The database has evaluated the match and determined a tiebreaker is needed
- The `match.tiebreakerStatus` is set to one of: `REQUIRES_TIEBREAKER`, `PENDING_TIEBREAKER`, or `NEEDS_DECISION`

✅ Tiebreaker games no longer appear prematurely when games haven't started or are still in progress
