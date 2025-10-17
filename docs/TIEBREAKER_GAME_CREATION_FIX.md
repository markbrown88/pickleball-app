# Tiebreaker Game Creation Error Fix

## Issue Summary
When trying to schedule a tiebreaker game from the manager page, the following error appeared:
```
{"error":"Failed to save games"}
```

This prevented event managers from creating tiebreaker games when a match was tied 2-2.

## Root Cause
The `/api/admin/matches/{matchId}/games` endpoint was creating the tiebreaker game in the database but **was not evaluating the match's tiebreaker status afterward**. 

When a tiebreaker game is created, the match's related fields need to be updated:
- `tiebreakerStatus` → should be set to `'PENDING_TIEBREAKER'`
- `tiebreakerGameId` → should be set to the new game's ID
- `totalPointsTeamA` and `totalPointsTeamB` → should be calculated from the 4 standard games

Without this evaluation, the match data in the database was incomplete, causing issues downstream.

## How It Should Work

1. **User clicks "Add Tiebreaker"** on manager page
2. **POST request sent** to `/api/admin/matches/{matchId}/games` with:
   ```json
   {
     "games": [{
       "slot": "TIEBREAKER",
       "teamAScore": null,
       "teamBScore": null,
       "teamALineup": null,
       "teamBLineup": null,
       "lineupConfirmed": false
     }]
   }
   ```
3. **Endpoint creates the game** ✓
4. **Endpoint evaluates match status** ← This was missing!
   - Calculates total points from the 4 standard games
   - Sets `tiebreakerStatus = 'PENDING_TIEBREAKER'`
   - Updates `tiebreakerGameId` to point to the new game

## The Fix

Updated `src/app/api/admin/matches/[matchId]/games/route.ts`:

### 1. Import evaluateMatchTiebreaker
```typescript
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';
```

### 2. Call it after creating tiebreaker game
```typescript
if (games.length === 1 && games[0].slot === 'TIEBREAKER') {
  // Create the tiebreaker game
  const tiebreakerGame = await prisma.game.create({
    data: {
      matchId,
      slot: 'TIEBREAKER',
      teamAScore: games[0].teamAScore || null,
      teamBScore: games[0].teamBScore || null,
      teamALineup: games[0].teamALineup || null,
      teamBLineup: games[0].teamBLineup || null,
      lineupConfirmed: games[0].lineupConfirmed || false
    }
  });
  
  // ✅ NEW: Evaluate match tiebreaker status now that the game exists
  await evaluateMatchTiebreaker(prisma, matchId);
  
  return NextResponse.json([tiebreakerGame]);
}
```

## Files Modified
- `src/app/api/admin/matches/[matchId]/games/route.ts`
  - Line 3: Added import for `evaluateMatchTiebreaker`
  - Line 130: Added call to `evaluateMatchTiebreaker` after creating game

## Result
✅ Tiebreaker games can now be created without errors
✅ Match status is properly updated when tiebreaker is created
✅ Event managers can see the tiebreaker game with decision options
✅ The "Decide by Points" button will appear if total points are unequal

## Related Functionality
This fix works in conjunction with:
- `NEEDS_DECISION_STATUS_FIX.md` - Ensures proper status mapping in the UI
- `TIEBREAKER_DISPLAY_FIX.md` - Controls when tiebreaker games are shown
