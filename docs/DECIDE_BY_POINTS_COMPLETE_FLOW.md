# Decide by Points - Complete Flow & What Happens

## Display Changes Added

### Total Points Summary
When a match has all 4 games completed, a new summary box will appear showing:
```
Total Points:                  Total Points:
Team A Name: 46                Team B Name: 41
```

This displays after the action buttons and before the game details.

### Match Status Badge
When a match decision is made, you'll see one of these badges:
- ✓ **Decided by Total Points** (green) - Match was resolved using total points
- ✓ **Decided by Tiebreaker** (green) - Match was resolved using tiebreaker game

## What Should Happen When You Click "Decide by Points"

### Step 1: Confirmation Dialog
You see: `"Confirm using total points to decide [Team A] vs [Team B]?"`
- Click OK to proceed
- Click Cancel to abort

### Step 2: Backend Processing
The system:
1. Loads the match with all games
2. Verifies all 4 standard games are complete with scores
3. Calculates total points for each team:
   - Sums all points from all 4 games
   - Example: Game 1: 11-9, Game 2: 8-11, Game 3: 10-11, Game 4: 12-10
   - TeamA total: 11+8+10+12 = 41
   - TeamB total: 9+11+11+10 = 41
4. Determines winner (team with more total points)
5. Updates match record in database:
   - `tiebreakerStatus = 'DECIDED_POINTS'`
   - `tiebreakerWinnerTeamId = [winning team ID]`
   - `totalPointsTeamA = 41`
   - `totalPointsTeamB = 41`
   - `tiebreakerDecidedAt = [current timestamp]`
6. Calls `evaluateMatchTiebreaker` to ensure all fields are consistent

### Step 3: Frontend Response
After successful API response:
1. Button shows "Resolving..." while processing
2. Manager page reloads with updated data:
   ```
   await loadGamesForMatch(match.id, true);  // Reload this match's games
   await loadSchedule(stopId, true);         // Reload entire stop schedule
   ```
3. Page displays:
   - ✓ Match Status Badge: "Decided by Total Points"
   - ✓ Total Points Summary showing both teams' totals
   - ✓ Winner is highlighted/determined
   - ✓ Action buttons disappear (match is now closed)
   - ✓ Success message: "Match decided by total points"

## Example Scenario

**Before:**
```
Pickleplex vs Pickleplex Oshawa
Match Status: 2-2 (tied)

Men's Doubles: Pickleplex 11, Oshawa 9 ✓ Pickleplex wins
Women's Doubles: Pickleplex 8, Oshawa 11 ✓ Oshawa wins
Mixed 1: Pickleplex 10, Oshawa 11 ✓ Oshawa wins
Mixed 2: Pickleplex 12, Oshawa 10 ✓ Pickleplex wins

Total Points: Pickleplex 41, Oshawa 41

Status: Games tied 2-2, Points tied 41-41 → NEEDS_DECISION
Buttons Visible: "Decide by Points" and "Add Tiebreaker"
```

**User clicks "Decide by Points" → Confirms dialog**

**After:**
```
✓ Decided by Total Points

Pickleplex vs Pickleplex Oshawa (Advanced) - COMPLETED
Total Points: Pickleplex 41, Oshawa 41

Men's Doubles: 11-9
Women's Doubles: 8-11
Mixed 1: 10-11
Mixed 2: 12-10

No action buttons (match is closed)

Database: 
  tiebreakerStatus = 'DECIDED_POINTS'
  tiebreakerWinnerTeamId = 'pickleplex-id'
  Match shows as "Complete"
```

**BUT if points were unequal:**
```
Total Points: Pickleplex 46, Oshawa 41

After clicking "Decide by Points":

✓ Decided by Total Points

Winner: Pickleplex (46 points > 41 points)
```

## What to Check If Nothing Happens

### Issue 1: Confirmation Dialog Doesn't Appear
- Check browser console for errors
- Verify match status is either 'needs_decision' or 'tied_pending' with unequal points

### Issue 2: Button Shows "Resolving..." Then Nothing Changes
- Check browser console for network errors
- Verify the PATCH request to `/api/admin/matches/{matchId}` succeeds
- Confirm database was updated with new `tiebreakerStatus`

### Issue 3: Page Reloads But Match Doesn't Show as Decided
- Verify `match.tiebreakerStatus` is now `'DECIDED_POINTS'` in database
- Check if status badge is displaying (green "Decided by Total Points")
- Verify total points are displaying correctly

### Issue 4: Total Points Not Showing
- Ensure all 4 standard games have scores entered
- Both `totalPointsTeamA` and `totalPointsTeamB` must be non-null in database

## Related Functionality

- **Add Tiebreaker**: Alternative to "Decide by Points" when total points ARE equal
- **Match Evaluation**: `evaluateMatchTiebreaker` recalculates status after every game update
- **Status Flow**: `NEEDS_DECISION` → (click button) → `DECIDED_POINTS` → Match Complete
