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

**What we need:**
1. Admin UI to merge two players
2. Automated Clerk account management (delete orphaned user, add secondary email to kept user)

## Merge Workflow

| Step | Who | Action |
|------|-----|--------|
| 1 | Admin | Use merge UI to select two players and preview what will be merged |
| 2 | Admin | Click merge button → API handles both database AND Clerk operations |
| 3 | System | Transfers all relationships from secondary → primary player |
| 4 | System | If both have Clerk accounts: adds secondary email to kept user, deletes orphaned Clerk user |
| 5 | System | Logs the merge for audit purposes |

After this, user can log in with either email → Clerk authenticates → our app finds correct player.

## Implementation Plan

### Phase 1: Schema Addition
**File:** `prisma/schema.prisma`

Add PlayerMergeLog for audit trail:
```prisma
model PlayerMergeLog {
  id                    String   @id @default(cuid())
  primaryPlayerId       String   // Player kept
  secondaryPlayerId     String   // Player deleted (store ID for reference)
  secondaryPlayerName   String   // Store name since player is deleted
  secondaryPlayerEmail  String?
  secondaryClerkUserId  String?  // Store for reference
  mergedBy              String   // Admin who performed merge
  transferredData       Json?    // Summary: { rosters: 5, lineups: 12, ... }
  clerkMergeStatus      String?  // 'SUCCESS' | 'PARTIAL' | 'MANUAL_REQUIRED'
  clerkMergeNotes       String?  // Any errors or notes from Clerk operations
  createdAt             DateTime @default(now())

  primaryPlayer         Player   @relation("MergedIntoPlayer", fields: [primaryPlayerId], references: [id])
  admin                 Player   @relation("MergePerformedBy", fields: [mergedBy], references: [id])
}
```

Update Player model to add relations:
```prisma
// Add to Player model
mergesAsKept          PlayerMergeLog[] @relation("MergedIntoPlayer")
mergesPerformed       PlayerMergeLog[] @relation("MergePerformedBy")
```

### Phase 2: Clerk Admin Utility
**File:** `src/lib/clerkAdmin.ts`

```typescript
import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

export async function mergeClerkAccounts(
  keepClerkId: string,
  deleteClerkId: string,
  emailToTransfer: string
): Promise<{ success: boolean; notes?: string }> {
  try {
    // Add email to kept user
    await clerkClient.emailAddresses.createEmailAddress({
      userId: keepClerkId,
      emailAddress: emailToTransfer,
    });
    
    // Delete orphaned user
    await clerkClient.users.deleteUser(deleteClerkId);
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      notes: error instanceof Error ? error.message : 'Unknown Clerk error'
    };
  }
}
```

### Phase 3: Merge API
**File:** `src/app/api/app-admin/players/merge/route.ts`

**POST** - Execute merge:
1. Validate admin permissions (app admin only)
2. Preview mode: return counts of what will be transferred
3. Execute mode: Transfer all relationships from secondary → primary:
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
   - `Club` (as director via ClubDirector)
   - `ClubDirector`
   - `Match` (tiebreakerDecidedBy)
   - `TournamentWaitlist`
   - `TournamentInvite` (both invitedBy and playerId)
   - `InviteRequest` (both playerId and reviewedBy)
   - `ActAsAuditLog` (both admin and target - these reference player)
4. If both players have Clerk accounts: call `mergeClerkAccounts()`
5. Log the merge in PlayerMergeLog
6. Delete secondary player
7. Return success with summary

**GET** - Fetch merge history for audit

### Phase 4: Admin Merge Page
**File:** `src/app/app-admin/merge-players/page.tsx`

Features:
- Search/select two players to merge
- Preview what will be transferred (rosters, lineups, registrations, etc.)
- Show Clerk account status for both players
- Select which player to keep (the "primary")
- Warning if both have Clerk accounts (explains automatic Clerk merge)
- Execute merge button
- Shows merge history/audit log

### Phase 5: Navigation Update
**File:** `src/app/shared/Navigation.tsx`

Add "Player Merges" under System menu (app admin only):
```typescript
{
  label: 'System',
  roles: ['app-admin'],
  children: [
    { href: '/admin/player-rankings', label: 'Player Rankings', roles: ['app-admin'] },
    { href: '/admin/settings/pricing', label: 'Pricing Settings', roles: ['app-admin'] },
    { href: '/admin/transactions', label: 'Transactions', roles: ['app-admin'] },
    { href: '/app-admin/merge-players', label: 'Player Merges', roles: ['app-admin'] }, // NEW
  ]
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add PlayerMergeLog + Player relations |
| `src/lib/clerkAdmin.ts` | Create | Clerk backend operations helper |
| `src/app/api/app-admin/players/merge/route.ts` | Create | Merge execution API |
| `src/app/app-admin/merge-players/page.tsx` | Create | Admin merge UI |
| `src/app/shared/Navigation.tsx` | Modify | Add menu item |

## Execution Order
1. Add `@clerk/backend` package
2. Add PlayerMergeLog to schema + migrate
3. Create Clerk admin utility
4. Create merge API endpoint
5. Create admin merge page
6. Add navigation link
7. Test with a known duplicate

## Environment Variables Required
```bash
# Already should exist for Clerk
CLERK_SECRET_KEY=sk_live_xxxxx  # Or sk_test_xxxxx for development
```

## Verification Plan

### Automated Tests
1. Unit test for conflict detection (duplicate rosters, etc.)
2. Integration test for merge API with mock Clerk client

### Manual Verification
1. Create two test player accounts with known data
2. Use merge UI to preview → verify counts are accurate
3. Execute merge → verify all data transferred
4. Verify Clerk operations (check Clerk dashboard)
5. Log in with secondary email → should access primary player's data
6. Check PlayerMergeLog for audit record
