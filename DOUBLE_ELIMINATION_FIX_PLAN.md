# Double Elimination Bracket - Complete Fix Plan

## Session Summary

This document outlines the complete plan to implement **true double elimination** brackets with bracket reset functionality. Created after extensive debugging session where we fixed the L3→L4 linking bug and discovered several structural issues.

---

## Issues Discovered

### ✅ FIXED: L3→L4 Linking Bug
**Problem**: Loser bracket round L4 was not getting linked to L3 because the generation code expected 2 winners from L3, but L3 only has 1 match.

**Fix Applied**: Modified [generate-bracket route.ts:505-524](src/app/api/admin/tournaments/[tournamentId]/generate-bracket/route.ts#L505-L524) to handle single-source advancement:
```typescript
// Handle case where there's only one winner from previous round (e.g., L3->L4)
if (sourceAIdx < prevLoserWinners.length) {
  const sourceB = sourceBIdx < prevLoserWinners.length ? prevLoserWinners[sourceBIdx] : null;
  const sourceBMatchId = sourceB ? matchIdMap.get(...) : null;
  // Set sourceMatchBId to null if only one source
}
```

**Status**: ✅ Complete - Brackets now display without structural errors

---

### ❌ CRITICAL: Missing Bracket Reset (True Double Elimination)

**Problem**: The current implementation creates only **ONE finals match**. True double elimination requires **TWO finals matches** to ensure both finalists have lost twice before elimination.

**Current Behavior**:
- Finals: Winner Bracket Champion vs Loser Bracket Champion
- Winner is tournament champion (regardless of who wins)

**Correct Behavior** (verified via web search):
1. **Finals Match 1**: WB Champion (0 losses) vs LB Champion (1 loss)
   - If WB Champion wins → Tournament Over (opponent has 2 losses)
   - If LB Champion wins → Both have 1 loss → Proceed to Finals Match 2

2. **Finals Match 2** ("Bracket Reset" or "If Necessary"):
   - Only played if LB Champion won Finals Match 1
   - Winner is tournament champion (both finalists now have had 1 loss)

**Impact**: HIGH - This is a core rule of double elimination tournaments

**Files to Modify**:
- `src/lib/brackets/doubleElimination.ts` - `createFinalsRound()` function
- `src/app/api/admin/tournaments/[tournamentId]/generate-bracket/route.ts` - Finals linking logic
- `src/lib/brackets/bracketTransformer.ts` - Finals transformation for display
- Match completion logic - to trigger Finals 2 creation when LB champion wins Finals 1

---

### ❌ BYE Match Display Issues

**Problem**: BYE matches are showing as "Complete ✓" with "WON" text next to the team name.

**Expected Behavior**:
- BYE matches should NOT be marked as complete
- Team should be displayed without a score or "WON" text
- Team should automatically advance to next round

**Current Display** (from screenshot):
```
L Round 4
┌─────────────────────────────┐
│ Pickleplex Promenade        │ WON
│ intermediate                │
│                             │
│ BYE                         │
└─────────────────────────────┘
● Complete
```

**Root Cause**: Unknown - could be:
1. Bracket generation marking BYE matches as complete
2. Transformer converting BYE status incorrectly
3. Display component rendering BYE matches with completion status

**Files to Investigate**:
- `src/lib/brackets/doubleElimination.ts` - BYE match creation
- `src/lib/brackets/bracketTransformer.ts:99-106` - BYE match state determination
- Match completion API - verify BYE matches aren't being completed

---

### ❌ Missing BYE in Loser Bracket First Round

**Problem**: With 7 teams, the first winner bracket round produces only **3 losers** (seeds 7, 6, and loser of 4v5). The first loser round (L0) needs 4 slots for 2 matches, so **one loser should get a BYE**.

**Current Behavior**: All 3 losers are paired into matches immediately (unclear from current data how this is handled)

**Expected Behavior**:
- L0 Match 0: Loser W0.0 (seed 7) vs Loser W0.1 (seed 6)
- L0 Match 1: Loser W0.2 (loser of 4v5) vs **BYE**
  - This match should be marked as BYE
  - Loser of 4v5 automatically advances to L1

**Files to Modify**:
- `src/lib/brackets/doubleElimination.ts` - Needs logic to detect when losers < 2×matches and create BYE
- `src/app/api/admin/tournaments/[tournamentId]/generate-bracket/route.ts` - Loser bracket pairing logic

---

### ⚠️ Tournament Type Inconsistency

**Note**: Tournament is type `DOUBLE_ELIMINATION_CLUBS` but documentation from earlier sessions mentions:
- Clubs are the primary entity (7 clubs seeded 1-7)
- Each club has teams in multiple brackets (Advanced, Intermediate, Beginner)
- Matches involve games across brackets × slots (e.g., 8 games = 2 brackets × 4 slots)

This may require special handling for:
- BYE matches (which games to create?)
- Match completion (all games must be complete?)
- Team advancement (club-level vs team-level)

**Files to Review**:
- `src/app/api/admin/tournaments/[tournamentId]/generate-bracket/route.ts:234-257` - Club-based game creation

---

## Implementation Plan

### Phase 1: Fix BYE Handling

**Priority**: High
**Complexity**: Medium
**Dependencies**: None

#### 1.1 Add BYE Detection in Loser Bracket Generation

**File**: `src/lib/brackets/doubleElimination.ts`

**Current L0 Creation** (line ~152):
```typescript
for (let matchIdx = 0; matchIdx < currentMatchCount; matchIdx++) {
  matches.push({
    teamAId: null,
    teamBId: null,
    bracketPosition: matchIdx,
    isBye: false, // ← Always false
    sourceMatchAId: null,
    sourceMatchBId: null,
  });
}
```

**Proposed Change**:
```typescript
// For L0, determine if we need a BYE
const isFirstLoserRound = roundIdx === 0;
const expectedLosersFromW0 = /* calculate based on winner bracket first round */;
const needsByeInL0 = isFirstLoserRound && (expectedLosersFromW0 < currentMatchCount * 2);

for (let matchIdx = 0; matchIdx < currentMatchCount; matchIdx++) {
  const isByeMatch = needsByeInL0 && matchIdx === currentMatchCount - 1;

  matches.push({
    teamAId: null,
    teamBId: null,
    bracketPosition: matchIdx,
    isBye: isByeMatch, // ← Set to true for last match if needed
    sourceMatchAId: null,
    sourceMatchBId: null,
  });
}
```

#### 1.2 Fix BYE Match Linking

**File**: `src/app/api/admin/tournaments/[tournamentId]/generate-bracket/route.ts`

**Current Issue**: When pairing W0 losers into L0, if there's a BYE match, only set `sourceMatchAId`:

**Location**: Around line 335-390 (first loser round linking)

**Proposed Change**:
```typescript
// When assigning losers to first loser round
if (loserMatch.isBye) {
  // BYE match - only assign sourceMatchAId
  await prisma.match.update({
    where: { id: loserMatchId },
    data: {
      sourceMatchAId: winnerLoserMatchId, // Team that gets the bye
      sourceMatchBId: null, // No opponent
      teamAId: null, // Will be filled when source match completes
      teamBId: null,
    },
  });
} else {
  // Regular match - assign both sources
  // ... existing logic
}
```

#### 1.3 Fix BYE Match Display State

**File**: `src/lib/brackets/bracketTransformer.ts`

**Current Code** (line 99-106):
```typescript
if (match.isBye) {
  state = 'WALK_OVER';
} else if (match.winnerId) {
  state = 'SCORE_DONE';
}
```

**Issue**: BYE matches with winnerId show as SCORE_DONE instead of WALK_OVER

**Proposed Fix**:
```typescript
if (match.isBye) {
  state = 'WALK_OVER'; // Always WALK_OVER for BYE matches
} else if (match.winnerId) {
  state = 'SCORE_DONE';
}
```

**Also check** (line 142-158): BYE participant rendering - ensure "WON" text isn't shown

---

### Phase 2: Implement Bracket Reset (True Double Elimination)

**Priority**: CRITICAL
**Complexity**: High
**Dependencies**: Phase 1 complete

#### 2.1 Modify Finals Round Creation

**File**: `src/lib/brackets/doubleElimination.ts`

**Current Code** (line 173-190):
```typescript
function createFinalsRound(stopId: string): BracketRound {
  return {
    stopId,
    idx: 9999,
    bracketType: 'FINALS',
    depth: 0,
    matches: [
      {
        teamAId: null,
        teamBId: null,
        bracketPosition: 0,
        isBye: false,
        sourceMatchAId: null,
        sourceMatchBId: null,
      },
    ],
  };
}
```

**Proposed Change**:
```typescript
function createFinalsRounds(stopId: string): BracketRound[] {
  return [
    {
      stopId,
      idx: 9999, // Will be updated
      bracketType: 'FINALS',
      depth: 1, // Finals Match 1 (higher depth)
      matches: [
        {
          teamAId: null, // Winner Bracket Champion
          teamBId: null, // Loser Bracket Champion
          bracketPosition: 0,
          isBye: false,
          sourceMatchAId: null,
          sourceMatchBId: null,
        },
      ],
    },
    {
      stopId,
      idx: 10000, // Will be updated
      bracketType: 'FINALS_RESET', // New bracket type
      depth: 0, // Finals Match 2 (if necessary)
      matches: [
        {
          teamAId: null, // Loser of Finals 1 (if WB champion lost)
          teamBId: null, // Winner of Finals 1 (must be LB champion)
          bracketPosition: 0,
          isBye: false,
          sourceMatchAId: null, // Points to Finals 1
          sourceMatchBId: null, // Also points to Finals 1 (special case)
        },
      ],
    },
  ];
}
```

**Note**: `FINALS_RESET` might need to be added to the Prisma schema as a new `BracketType` enum value, OR we can use `FINALS` for both and differentiate by depth/idx.

#### 2.2 Database Schema Changes

**File**: `prisma/schema.prisma`

**Check if BracketType enum needs update**:
```prisma
enum BracketType {
  WINNER
  LOSER
  FINALS
  FINALS_RESET // ← Add if using separate type
}
```

**Alternative**: Use `FINALS` for both matches and differentiate by:
- Match depth (1 vs 0)
- Match idx (first finals vs second finals)
- Source match configuration

#### 2.3 Finals Linking Logic

**File**: `src/app/api/admin/tournaments/[tournamentId]/generate-bracket/route.ts`

**Current Code** (around line 530-560): Links one finals match

**Proposed Logic**:
```typescript
// Link Finals Match 1
const finalsRound1 = finalsRounds[0];
const finalsRound2 = finalsRounds[1];

const finals1Match = finalsRound1.matches[0];
const finals2Match = finalsRound2.matches[0];

// Finals 1 receives winner from WB final and LB final
const winnerFinal = winnerRounds[winnerRounds.length - 1].matches[0];
const loserFinal = loserRounds[loserRounds.length - 1].matches[0];

await prisma.match.update({
  where: { id: finals1MatchId },
  data: {
    sourceMatchAId: winnerFinalMatchId, // WB champion
    sourceMatchBId: loserFinalMatchId,  // LB champion
  },
});

// Finals 2 receives FROM Finals 1 (special case)
// This match is conditional - only played if LB champion wins Finals 1
await prisma.match.update({
  where: { id: finals2MatchId },
  data: {
    sourceMatchAId: finals1MatchId, // Winner of Finals 1
    sourceMatchBId: finals1MatchId, // Loser of Finals 1 (same source!)
    // Both teams come from Finals 1, but in swapped positions
  },
});
```

**Special Handling Required**: When Finals 1 completes, check the winner:
- If WB champion wins → Mark Finals 2 as "Not Needed" or hide it
- If LB champion wins → Populate Finals 2 with both teams

#### 2.4 Match Completion Logic for Finals 1

**New File Needed**: Hook/trigger for Finals 1 completion

**Logic**:
```typescript
// When Finals 1 is completed via match completion API
async function onFinalsMatchComplete(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { round: true },
  });

  if (match.round.bracketType === 'FINALS' && match.round.depth === 1) {
    // This is Finals Match 1

    // Check if WB champion won or LB champion won
    const wbChampionTeamId = /* determine from sourceMatchA winner */;
    const lbChampionTeamId = /* determine from sourceMatchB winner */;

    if (match.winnerId === wbChampionTeamId) {
      // WB champion won - tournament is over
      // Mark Finals 2 as "Not Needed" or delete it
      await prisma.match.update({
        where: { /* Finals 2 match */ },
        data: {
          // Option 1: Mark as completed with no winner (skipped)
          // Option 2: Delete it
          // Option 3: Add a new field: isSkipped: true
        },
      });
    } else {
      // LB champion won - Finals 2 must be played
      // Populate Finals 2 with both teams (bracket reset)
      await prisma.match.update({
        where: { /* Finals 2 match */ },
        data: {
          teamAId: wbChampionTeamId, // Now has 1 loss
          teamBId: lbChampionTeamId, // Also has 1 loss
        },
      });
    }
  }
}
```

**Integration Point**: Match completion API route

#### 2.5 Display Bracket Reset Matches

**File**: `src/lib/brackets/bracketTransformer.ts`

**Challenge**: The react-tournament-brackets library doesn't natively support bracket reset.

**Options**:
1. **Display as separate round**: Finals 1 and Finals 2 shown side-by-side
2. **Display conditionally**: Only show Finals 2 if LB champion won Finals 1
3. **Custom component**: Create custom finals display component

**Recommendation**: Option 2 - conditionally display Finals 2

**Proposed Logic**:
```typescript
// In transformRoundsToBracketFormat
const finalsRounds = rounds.filter(r => r.bracketType === 'FINALS' || r.bracketType === 'FINALS_RESET');

if (finalsRounds.length === 2) {
  const finals1 = finalsRounds[0];
  const finals2 = finalsRounds[1];

  // Only include Finals 2 if it's needed (LB champion won Finals 1)
  const finals1Match = finals1.matches[0];
  const shouldShowFinals2 = finals1Match.winnerId === /* LB champion ID */;

  if (shouldShowFinals2) {
    // Add both finals to upper bracket
    upperMatches.push(convertMatch(finals1Match, finals1, ...));
    upperMatches.push(convertMatch(finals2.matches[0], finals2, ...));
  } else {
    // Only add Finals 1
    upperMatches.push(convertMatch(finals1Match, finals1, ...));
  }
}
```

---

### Phase 3: Testing & Validation

**Priority**: Critical
**Complexity**: Medium

#### 3.1 Test Cases

Create test scenarios for:

1. **7-Team Bracket with BYE**:
   - ✅ BYE match created in L0
   - ✅ Team with BYE advances automatically
   - ✅ BYE match shows correct display state (not "Complete")

2. **WB Champion Wins Finals 1**:
   - ✅ Tournament ends after Finals 1
   - ✅ Finals 2 not played/shown
   - ✅ WB Champion declared winner

3. **LB Champion Wins Finals 1**:
   - ✅ Finals 2 becomes available
   - ✅ Both teams advance to Finals 2
   - ✅ Winner of Finals 2 is tournament champion

4. **Complete Tournament Flow**:
   - Generate bracket for 7 teams
   - Complete all W0 matches
   - Verify 3 losers drop to L0 (one with BYE)
   - Complete all matches through to Finals
   - Test both Finals 1 outcome scenarios

#### 3.2 Database Verification Scripts

**Create scripts** to verify:
- Round counts are correct (3 winner, 5 loser, 2 finals = 10 total)
- Match linking is complete (no orphaned matches)
- BYE matches are marked correctly
- Finals 1 and 2 are properly linked

---

## Current Bracket Structure (7 Teams)

### Winner Bracket
- **W0** (Quarters): 4 matches
  - Match 0: Seed 1 vs BYE
  - Match 1: Seed 2 vs Seed 7
  - Match 2: Seed 3 vs Seed 6
  - Match 3: Seed 4 vs Seed 5

- **W1** (Semis): 2 matches
  - Match 0: Winner W0.0 vs Winner W0.1
  - Match 1: Winner W0.2 vs Winner W0.3

- **W2** (Finals): 1 match
  - Match 0: Winner W1.0 vs Winner W1.1

### Loser Bracket
- **L0**: 2 matches ← **NEEDS BYE**
  - Match 0: Loser W0.0 vs Loser W0.1
  - Match 1: Loser W0.2 vs **BYE** ← Should be BYE

- **L1**: 2 matches (Drop round)
  - Match 0: Winner L0.0 vs Loser W1.0
  - Match 1: Winner L0.1 vs Loser W1.1

- **L2**: 1 match (Advance round)
  - Match 0: Winner L1.0 vs Winner L1.1

- **L3**: 1 match (Drop round)
  - Match 0: Winner L2.0 vs Loser W2.0

- **L4**: 1 match (Loser bracket final)
  - Match 0: Winner L3.0 (advances to Finals)

### Finals ← **NEEDS BRACKET RESET**
- **Finals 1**: WB Champion vs LB Champion
  - If WB wins → Tournament over
  - If LB wins → Proceed to Finals 2

- **Finals 2** (If Necessary): Bracket Reset
  - WB Champion (now 1 loss) vs LB Champion (now 1 loss)
  - Winner is tournament champion

---

## Technical Notes

### Depth Calculation
Currently used for round labeling (W Finals, L Finals, etc.). With bracket reset:
- Finals 1: `depth = 1`
- Finals 2: `depth = 0`

This maintains the pattern where depth decreases as you approach the final match.

### Round Index (idx)
- Winner: 0-2 (3 rounds)
- Loser: 3-7 (5 rounds)
- Finals 1: 8
- Finals 2: 9
- **Total: 10 rounds**

### BracketType Values
Current: `WINNER`, `LOSER`, `FINALS`

Proposed options:
1. Add `FINALS_RESET` enum value
2. Keep `FINALS` for both, differentiate by depth/idx
3. Add `is_reset_match` boolean field to Match model

**Recommendation**: Option 3 (add boolean field) for flexibility

---

## Files Reference

### Primary Files to Modify

1. **src/lib/brackets/doubleElimination.ts**
   - `createLoserBracket()` - Add BYE logic
   - `createFinalsRound()` → `createFinalsRounds()` - Return 2 matches
   - `linkBracketProgression()` - Update for 2 finals

2. **src/app/api/admin/tournaments/[tournamentId]/generate-bracket/route.ts**
   - First loser round linking - Handle BYE matches
   - Finals linking - Link both Finals 1 and Finals 2
   - Add logging for bracket reset setup

3. **src/lib/brackets/bracketTransformer.ts**
   - BYE match state handling
   - Finals 2 conditional inclusion
   - Bracket reset display logic

4. **Match Completion API** (TBD - find the route)
   - Add hook for Finals 1 completion
   - Trigger Finals 2 population or skip

### Secondary Files

5. **prisma/schema.prisma**
   - Possibly add `FINALS_RESET` to BracketType enum
   - OR add `isResetMatch` boolean to Match model

6. **src/app/manager/components/BracketMatchManager/index.tsx**
   - May need updates for Finals 2 display
   - Handle "match not needed" state

---

## Success Criteria

- [ ] BYE matches display correctly (no "Complete" or "WON" text)
- [ ] Loser of 4v5 gets BYE in first loser round (L0)
- [ ] Finals 1 always plays
- [ ] If WB champion wins Finals 1, tournament ends
- [ ] If LB champion wins Finals 1, Finals 2 is played
- [ ] Winner of Finals 2 (if played) is tournament champion
- [ ] All matches link correctly (no orphans)
- [ ] Bracket displays without errors
- [ ] Teams advance correctly through loser bracket
- [ ] True double elimination rule enforced (2 losses to eliminate)

---

## Known Issues / Edge Cases

1. **Club-Based Tournament Complexity**:
   - BYE matches in club tournaments - which games to create?
   - Match completion requires all games complete - how handle BYE?

2. **UI Display Limitations**:
   - `react-tournament-brackets` library may not support conditional Finals 2
   - May need custom component for bracket reset visualization

3. **Database Cleanup**:
   - Multiple stops exist - ensure old data is cleaned up before regeneration
   - Script needed: Delete all rounds/matches for a stop before regeneration

4. **Match Completion Cascade**:
   - When Finals 1 completes, need to update Finals 2 OR mark tournament complete
   - Winner ID propagation through bracket reset

---

## Next Steps

1. **Review this plan** for completeness
2. **Start with Phase 1** (BYE handling) in a new session
3. **Test Phase 1 thoroughly** before proceeding to Phase 2
4. **Implement Phase 2** (bracket reset) with careful testing
5. **Create admin UI** for regenerating brackets with old data cleanup

---

## Session History

- **2025-01-XX**: Fixed L3→L4 linking bug, discovered missing bracket reset
- **2025-01-XX**: Created comprehensive fix plan for true double elimination

