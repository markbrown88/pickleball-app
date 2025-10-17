# Lineup Display Bug Fix - Manager Page

## Issue Summary
When lineups were displayed on the `/manager` page, all games showed only the two men from each team, regardless of the game type (Men's Doubles, Women's Doubles, Mixed 1, Mixed 2).

**Root Cause:** Old code was taking only the first 2 players from the 4-player lineup array for all game types.

## How Lineups Are Structured
Lineups are stored as an array of 4 players in a specific order:
```
[Man1, Man2, Woman1, Woman2]
```

Games require specific combinations based on their slot:
- **MENS_DOUBLES**: Man1 & Man2
- **WOMENS_DOUBLES**: Woman1 & Woman2
- **MIXED_1**: Man1 & Woman1
- **MIXED_2**: Man2 & Woman2

## The Bug
In `src/app/manager/components/EventManagerTab.tsx`, the `getTeamALineup()` and `getTeamBLineup()` functions had logic that correctly handled lineup display when using the `lineups` state object (the fallback path). However, when `game.teamALineup` was populated from the schedule API, the code took a shortcut:

```typescript
// OLD CODE - BUGGY
const players = game.teamALineup.slice(0, 2);  // ❌ Only gets first 2 (the men)
return players.map((player: any) => player.name).join(' &\n');
```

This always returned only the first 2 players, which are the men, causing Women's Doubles and Mixed games to display incorrectly.

## The Fix
The functions were updated to apply the correct switch logic based on `game.slot` when `game.teamALineup` exists, matching the behavior of the fallback logic:

```typescript
// NEW CODE - FIXED
if (game.teamALineup && Array.isArray(game.teamALineup)) {
  const man1 = game.teamALineup[0];
  const man2 = game.teamALineup[1];
  const woman1 = game.teamALineup[2];
  const woman2 = game.teamALineup[3];

  switch (game.slot) {
    case 'MENS_DOUBLES':
      return man1 && man2 ? `${man1.name} &\n${man2.name}` : 'Team A';
    case 'WOMENS_DOUBLES':
      return woman1 && woman2 ? `${woman1.name} &\n${woman2.name}` : 'Team A';
    case 'MIXED_1':
      return man1 && woman1 ? `${man1.name} &\n${woman1.name}` : 'Team A';
    case 'MIXED_2':
      return man2 && woman2 ? `${man2.name} &\n${woman2.name}` : 'Team A';
    // ...
  }
}
```

## Why This Fix Worked
- **For Captain Portal:** Already working correctly (using the fallback `lineups` state path)
- **For Manager Page:** Now uses the same correct logic path regardless of whether lineups come from `game.teamALineup` (API data) or `lineups[match.id]` (state data)
- **Consistency:** Both code paths now apply the same game slot logic

## Files Modified
- `src/app/manager/components/EventManagerTab.tsx`
  - `getTeamALineup()` function (lines ~178-213)
  - `getTeamBLineup()` function (lines ~215-250)

## Testing Verification
The fix ensures that when viewing the manager page, all game types display the correct player combinations:
- ✅ Men's Doubles shows 2 men
- ✅ Women's Doubles shows 2 women
- ✅ Mixed 1 shows 1 man and 1 woman
- ✅ Mixed 2 shows 1 man (different) and 1 woman (different)
