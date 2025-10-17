# "Decide by Points" Feature - Complete Flow

## What Should Happen

When you click the **"Decide by Points"** button on a match that is:
- Tied 2-2 on the standard 4 games
- Has unequal total points across those 4 games

The system should:

1. **Confirm with you** - Shows a confirmation dialog: "Confirm using total points to decide [Team A] vs [Team B]?"
2. **Calculate total points** - Sums up all points from the 4 standard games for each team
3. **Determine winner** - The team with more total points wins the match
4. **Update match status** - Sets `tiebreakerStatus = 'DECIDED_POINTS'` and records the winner
5. **Mark match complete** - The match is now decided and won't show decision buttons anymore
6. **Refresh display** - Updates the manager page to show the match is complete

## Step-by-Step Flow

### Frontend (src/app/manager/components/EventManagerTab.tsx)

```typescript
const resolveMatchByPoints = async (match: any) => {
  // 1. Validate match is in correct state
  if (derivedStatus !== 'tied_requires_tiebreaker' && derivedStatus !== 'needs_decision') {
    return; // Not valid for this operation
  }

  // 2. Get team names
  const teamAName = match.teamA?.name || 'Team A';
  const teamBName = match.teamB?.name || 'Team B';
  
  // 3. Show confirmation dialog
  const confirmMessage = `Confirm using total points to decide ${teamAName} vs ${teamBName}?`;
  if (!window.confirm(confirmMessage)) {
    return; // User cancelled
  }

  // 4. Send PATCH request to API
  const response = await fetchWithActAs(`/api/admin/matches/${match.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decideByPoints: true,  // ← Special flag for this operation
    }),
  });

  // 5. Reload data to reflect changes
  await loadGamesForMatch(match.id, true);
  await loadSchedule(stopId, true);
  
  // 6. Show success message
  onInfo('Match decided by total points');
};
```

### Backend (src/app/api/admin/matches/[matchId]/route.ts)

```typescript
async function decideMatchByPoints(matchId: string) {
  // 1. Load match with all games
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      games: true,
    },
  });

  // 2. Verify all 4 standard games are complete with scores
  const standardGames = match.games.filter((g) =>
    ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'].includes(g.slot ?? ''),
  );
  
  if (standardGames.length !== 4 || 
      standardGames.some((g) => g.teamAScore == null || g.teamBScore == null)) {
    return error('Standard games must be completed before deciding by points.');
  }

  // 3. Calculate total points for each team
  const tally = standardGames.reduce(
    (acc, game) => {
      const a = game.teamAScore ?? 0;
      const b = game.teamBScore ?? 0;
      acc.pointsA += a;
      acc.pointsB += b;
      if (a > b) acc.winsA += 1;
      else if (b > a) acc.winsB += 1;
      return acc;
    },
    { pointsA: 0, pointsB: 0, winsA: 0, winsB: 0 },
  );

  // 4. Determine winner based on total points
  const winnerTeamId = tally.pointsA > tally.pointsB 
    ? match.teamAId 
    : match.teamBId;

  // 5. Update match record
  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: {
      tiebreakerStatus: 'DECIDED_POINTS',      // ← Match is now decided
      tiebreakerWinnerTeamId: winnerTeamId,    // ← Winner recorded
      totalPointsTeamA: tally.pointsA,         // ← Total points saved
      totalPointsTeamB: tally.pointsB,         // ← Total points saved
      tiebreakerDecidedAt: new Date(),         // ← Timestamp recorded
    },
  });

  // 6. Evaluate match (ensures all fields are consistent)
  await evaluateMatchTiebreaker(prisma, matchId);

  return JSON.json({ ok: true, match: updatedMatch });
}
```

## Example Scenario

**Match: Pickleplex vs Pickleplex Oshawa**

### Game Scores:
- Men's Doubles: Pickleplex 11, Pickleplex Oshawa 9 ✓ Pickleplex wins
- Women's Doubles: Pickleplex 8, Pickleplex Oshawa 11 ✓ Pickleplex Oshawa wins
- Mixed 1: Pickleplex 10, Pickleplex Oshawa 11 ✓ Pickleplex Oshawa wins
- Mixed 2: Pickleplex 12, Pickleplex Oshawa 10 ✓ Pickleplex wins

### Result:
- **Match Status**: 2-2 tie (both teams won 2 games each)
- **Total Points**: Pickleplex = 41, Pickleplex Oshawa = 41
- **Action Available**: Neither "Decide by Points" nor "Add Tiebreaker" (points are equal!)

**BUT if Mixed 2 was** Pickleplex 15, Pickleplex Oshawa 10:
- **Total Points**: Pickleplex = 46, Pickleplex Oshawa = 41
- **Action Available**: "Decide by Points" button shows ✓
- **When clicked**: Pickleplex wins the match based on total points (46 > 41)

## Result After Clicking "Decide by Points"

### Database Changes:
```javascript
{
  tiebreakerStatus: 'DECIDED_POINTS',    // Match decided by points (not tiebreaker)
  tiebreakerWinnerTeamId: 'pickleplex-id',
  totalPointsTeamA: 46,
  totalPointsTeamB: 41,
  tiebreakerDecidedAt: 2025-10-17T14:30:00Z
}
```

### UI Changes:
- ❌ "Decide by Points" button disappears
- ❌ "Add Tiebreaker" button disappears
- ✅ Match shows as "Complete"
- ✅ Winner is highlighted/marked

## When This Button Appears

✅ Button shows when:
- All 4 standard games are completed (have scores)
- Match is tied 2-2 (each team won 2 games)
- **Total points are UNEQUAL** (this is the key difference from "Add Tiebreaker")

❌ Button does NOT show when:
- Any standard games are incomplete
- Match is not 2-2
- Total points are equal (must use "Add Tiebreaker" instead)
- Match is already decided

## Related Features

- **Add Tiebreaker**: Shows when points ARE equal (need to play tiebreaker to decide)
- **Decide by Points vs Add Tiebreaker**: Mutually exclusive based on total points being equal or unequal
- **Match Status**: Transitions from `NEEDS_DECISION` → `DECIDED_POINTS` when this button is clicked
