# Admin Player Merge Feature

## Problem Statement
Players have duplicate accounts because they signed up with different emails. Their play history gets split across multiple player records.

**Remaining duplicates with both Clerk accounts:**
- Phil Milanis (2 accounts, different clubs)
- Joan DeMichino (2 accounts, rogers vs gmail)
- Stacey Ainsworth (2 accounts)
- Mike Harvey (2 accounts)
- John Travis (2 accounts, different clubs)

## Solution

**No PlayerEmail table needed** - Since tournament registration requires login, Clerk handles all email authentication. Secondary emails only need to exist in Clerk, not our database.

**Just need:** Admin UI to merge two players

## Merge Workflow

| Step | Who | Action |
|------|-----|--------|
| 1 | Admin | Use merge UI to select two players and merge them |
| 2 | Admin | Delete orphaned Clerk user in Clerk Dashboard |
| 3 | Admin | Add secondary email to kept Clerk user |

After this, user can log in with either email → Clerk authenticates → our app finds correct player.

## Implementation Plan

### Phase 1: Admin Merge Page
**File:** `src/app/admin/player-merges/page.tsx`

Features:
- Search/select two players to merge
- Preview what will be transferred (rosters, lineups, registrations, etc.)
- Select which player to keep (the "primary")
- Execute merge button
- Shows merge history/audit log

### Phase 2: Merge API
**File:** `src/app/api/admin/player-merges/route.ts`

**POST** - Execute merge:
1. Validate admin permissions (app admin only)
2. Transfer all relationships from secondary → primary:
   - `StopTeamPlayer` (roster entries)
   - `LineupEntry` (as player1 and player2)
   - `TeamPlayer` (team memberships)
   - `TournamentRegistration`
   - `Team` (as captain)
   - `CaptainInvite`
   - `TournamentAdmin`
   - `TournamentCaptain`
   - `TournamentEventManager`
   - `Stop` (as eventManager)
   - `Club` (as director)
   - `Match` (tiebreakerDecidedBy)
3. Log the merge (who merged, when, which players)
4. Delete secondary player
5. Return success

**GET** - Fetch merge history for audit

### Phase 3: Merge Audit Log
**Schema addition:**
```prisma
model PlayerMergeLog {
  id                    String   @id @default(cuid())
  primaryPlayerId       String   // Player kept
  secondaryPlayerId     String   // Player deleted (store ID for reference)
  secondaryPlayerName   String   // Store name since player is deleted
  secondaryPlayerEmail  String?
  mergedBy              String   // Admin who performed merge
  createdAt             DateTime @default(now())

  primaryPlayer         Player   @relation(fields: [primaryPlayerId], references: [id])
  admin                 Player   @relation("MergeAdmin", fields: [mergedBy], references: [id])
}
```

### Phase 4: Navigation Update
**File:** `src/app/shared/Navigation.tsx`
- Add "Player Merges" under System menu (app admin only)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add PlayerMergeLog for audit trail |
| `src/app/admin/player-merges/page.tsx` | Create | Admin merge UI |
| `src/app/api/admin/player-merges/route.ts` | Create | Merge execution API |
| `src/app/shared/Navigation.tsx` | Modify | Add menu item |

## Execution Order
1. Add PlayerMergeLog to schema + migrate
2. Create merge API endpoint
3. Create admin merge page
4. Add navigation link
