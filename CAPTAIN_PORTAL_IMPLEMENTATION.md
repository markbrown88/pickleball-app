# Captain Portal Implementation Guide

## Overview
This guide outlines the complete implementation of the Captain Portal feature for team captains to manage lineups and enter scores.

## Database Changes

### 1. Run Migration SQL
Execute `migration-captain-portal.sql` in Supabase SQL Editor to add:
- `TournamentClub.captainAccessToken` (5-char unique token)
- `Stop.lineupDeadline` (datetime for lineup submission deadline)
- `Game.teamAScoreSubmitted`, `teamBScoreSubmitted` (score confirmation)
- `Game.teamASubmittedScore`, `teamBSubmittedScore` (submitted scores)

### 2. Token Auto-Generation
✅ Already implemented in `/api/admin/tournaments/[tournamentId]/config/route.ts`
- Tokens are auto-generated when clubs are added to tournaments
- Uses `generateCaptainToken()` from `/lib/captainToken.ts`

## URL Structure
`/captain/[token]` → Landing page with stops
`/captain/[token]/stop/[stopId]` → Brackets for a stop
`/captain/[token]/stop/[stopId]/bracket/[bracketId]` → Rounds for a bracket
`/captain/[token]/stop/[stopId]/bracket/[bracketId]/round/[roundId]` → Games lineup & scores

## API Routes to Create

### 1. `/api/captain/[token]/route.ts` - Main Portal Data
```typescript
GET - Returns tournament, club, and stops with completion status
Response: {
  tournament: { id, name },
  club: { id, name },
  stops: [{
    id, name, startAt, lineupDeadline,
    status: 'completed' | 'upcoming',
    lineupsComplete: boolean
  }]
}
```

### 2. `/api/captain/[token]/stop/[stopId]/route.ts` - Stop Details
```typescript
GET - Returns brackets for a stop with team info
Response: {
  stop: { id, name, lineupDeadline },
  brackets: [{
    id, name,
    team: { id, name }, // This club's team in this bracket
    lineupsComplete: boolean
  }]
}
```

### 3. `/api/captain/[token]/stop/[stopId]/bracket/[bracketId]/route.ts` - Rounds
```typescript
GET - Returns rounds with match info
Response: {
  rounds: [{
    id, idx,
    match: {
      id,
      teamA: { id, name },
      teamB: { id, name },
      opponentTeam: { id, name }, // The other team (not this club's)
      lineupsComplete: boolean
    }
  }]
}
```

### 4. `/api/captain/[token]/stop/[stopId]/bracket/[bracketId]/round/[roundId]/route.ts` - Games
```typescript
GET - Returns games with lineups and scores
POST - Submit lineup
PUT - Submit/confirm score

Response: {
  round: { id, idx },
  match: { id, teamA, teamB },
  isTeamA: boolean, // Is this club Team A?
  games: [{
    id, slot,
    teamALineup: [{id, name, gender}] | null,
    teamBLineup: [{id, name, gender}] | null,
    teamAScore, teamBScore,
    teamAScoreSubmitted, teamBScoreSubmitted,
    isComplete, startedAt
  }],
  roster: [{id, name, gender}], // Available players for this club
  canEdit: boolean, // Based on deadline
  canViewOpponent: boolean // After deadline
}

POST Body: {
  gameId: string,
  lineup: [playerId1, playerId2] // 2 or 4 players depending on slot
}

PUT Body: {
  gameId: string,
  teamAScore: number,
  teamBScore: number
}
```

## Frontend Pages

### 1. `/captain/[token]/page.tsx` - Landing Page
- Show tournament name & club name
- List all stops with status
- Countdown timer to nearest deadline
- Completion indicators

### 2. Stop/Bracket/Round Pages
Use a single component with view state to simulate navigation:
```typescript
type View =
  | { type: 'stop', stopId: string }
  | { type: 'bracket', stopId: string, bracketId: string }
  | { type: 'round', stopId, bracketId, roundId: string }
  | { type: 'games', stopId, bracketId, roundId, gameId?: string };
```

### 3. Games/Lineup Component
- Dropdown selectors for player positions
- Gender filtering (Male for Men's Doubles, etc.)
- Prevent duplicate selections
- Disabled slots for opponent team
- Show opponent lineups only after deadline
- Score entry with confirmation flow

## Score Confirmation Flow

1. **Team A submits score** (11-5):
   - Save to `teamASubmittedScore` = 11, `teamBSubmittedScore` = 5
   - Set `teamAScoreSubmitted` = true
   - Show "Waiting for opponent confirmation"

2. **Team B confirms** (11-5):
   - If scores match:
     - Set `teamAScore` = 11, `teamBScore` = 5
     - Set `isComplete` = true, `endedAt` = now()
     - Set both `teamAScoreSubmitted` and `teamBScoreSubmitted` = true
   - If scores don't match:
     - Show mismatch UI
     - Allow re-submission
     - Require both teams to agree

3. **Start Game**:
   - Set `startedAt` = now() when first score is entered

## Lineup Selection Logic

For each game slot:
- **Men's Doubles**: 2 males from roster
- **Women's Doubles**: 2 females from roster
- **Mixed 1**: 1 male + 1 female (position 0 male, position 1 female)
- **Mixed 2**: 1 male + 1 female (position 0 male, position 1 female)

Validation:
- No player can be in same slot twice
- Mixed games must have one of each gender
- Must select from stop-specific roster

Save format:
```json
{
  "teamALineup": [
    {"player1Id": "xxx", "player2Id": "yyy"}
  ]
}
```

## Deadline Management

### Add to Tournament Config Page
Add lineup deadline input for each stop:
```typescript
stops: [{
  id, name, startAt, endAt,
  lineupDeadline: DateTime // NEW FIELD
}]
```

### Deadline Validation
- Before deadline: Can edit lineups, cannot see opponent lineups
- After deadline: Read-only lineups, can view opponent lineups
- Can still enter/confirm scores after deadline

## Implementation Steps

1. ✅ Update Prisma schema
2. ⏳ Run migration SQL
3. ⏳ Create API routes (`/api/captain/...`)
4. ⏳ Build captain portal pages
5. ⏳ Add lineup deadline to tournament config UI
6. ⏳ Test with Stop 3+ of Klyng tournament

## Testing Checklist

- [ ] Token auto-generation when club added
- [ ] Captain portal accessible via token URL
- [ ] Lineup selection with gender filtering
- [ ] Lineup save/load functionality
- [ ] Deadline enforcement (edit vs view-only)
- [ ] Score submission and confirmation
- [ ] Score mismatch handling
- [ ] Completion indicators at all levels
- [ ] Mobile responsive design

## Files Created/Modified

### Created:
- `src/lib/captainToken.ts`
- `migration-captain-portal.sql`
- `CAPTAIN_PORTAL_IMPLEMENTATION.md` (this file)

### Modified:
- `prisma/schema.prisma`
- `src/app/api/admin/tournaments/[tournamentId]/config/route.ts`

### To Create:
- `src/app/captain/[token]/page.tsx`
- `src/app/captain/[token]/stop/[stopId]/page.tsx`
- `src/app/api/captain/[token]/route.ts`
- `src/app/api/captain/[token]/stop/[stopId]/route.ts`
- `src/app/api/captain/[token]/stop/[stopId]/bracket/[bracketId]/route.ts`
- `src/app/api/captain/[token]/stop/[stopId]/bracket/[bracketId]/round/[roundId]/route.ts`
