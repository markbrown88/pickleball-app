# Registration System - Final Rules & Logic

**Date**: 2025-11-05
**Status**: Requirements Finalized & Validated

---

## Tournament Types - Complete Definition

### Type 1: Club/Team-Based Tournaments

**Structure**:
- Multiple clubs compete against each other
- Each club has teams in different brackets (skill levels)
- Standard game types: MD, WD, Mixed 1, Mixed 2, Men's Singles, Women's Singles
- **ALL brackets must have ALL 6 game types** (enforced by system)

**Example**:
```
Tournament: "Summer League 2025"
├── Bracket 2.5
│   ├── Men's Doubles
│   ├── Women's Doubles
│   ├── Mixed Doubles 1
│   ├── Mixed Doubles 2
│   ├── Men's Singles
│   └── Women's Singles
└── Bracket 3.0
    ├── Men's Doubles
    ├── Women's Doubles
    ├── Mixed Doubles 1
    ├── Mixed Doubles 2
    ├── Men's Singles
    └── Women's Singles
```

**Player Registration Flow**:
1. Select **one club** they represent (per stop)
2. Select **one bracket/skill level** (e.g., 3.0)
3. System automatically includes them in ALL game types for that bracket
4. Captain decides which games/lineups they play in

**Constraints**:
- ✅ Can select different bracket per stop
- ✅ Can select different club per stop
- ❌ Cannot select multiple brackets at same stop
- ❌ Cannot select multiple clubs at same stop
- ❌ Cannot select specific game types (all included automatically)

**Pricing**: Single fee covers all game types within selected bracket.

---

### Type 2: Individual Tournaments

**Structure**:
- No club affiliation
- Game types: MD, WD, Mixed Doubles, Men's Singles, Women's Singles
- Each game type can have multiple skill level brackets

**Example**:
```
Tournament: "Spring Open 2025"
├── Men's Doubles
│   ├── 2.5 bracket
│   └── 3.0 bracket
├── Women's Doubles
│   ├── 2.5 bracket
│   └── 3.0 bracket
├── Mixed Doubles
│   ├── 2.5 bracket
│   └── 3.0 bracket
├── Men's Singles
│   ├── 2.5 bracket
│   └── 3.0 bracket
└── Women's Singles
    ├── 2.5 bracket
    └── 3.0 bracket
```

**Player Registration Flow**:
1. Select which game types they want to play
2. Select **one bracket per game type**
3. Pay per game type selected

**Men can select**:
- One bracket for Men's Doubles (e.g., 3.0 MD)
- One bracket for Mixed Doubles (e.g., 3.5 Mixed)
- One bracket for Men's Singles (e.g., 3.0 Singles)

**Women can select**:
- One bracket for Women's Doubles (e.g., 3.0 WD)
- One bracket for Mixed Doubles (e.g., 3.5 Mixed)
- One bracket for Women's Singles (e.g., 3.0 Singles)

**Constraints**:
- ✅ Can select multiple game types (max 3 for men, max 3 for women)
- ✅ Can select different bracket per game type (3.0 Singles + 3.5 Doubles)
- ❌ Cannot select multiple brackets for same game type (e.g., 3.0 MD AND 3.5 MD)
- ❌ UI should only show game types relevant to player's gender

**Pricing**: Individual fee per game type selected.

---

## Game Type Configuration System

### Admin Setup: Enable/Disable Game Types

**Requirement**: Tournament admins must be able to enable/disable specific game type × bracket combinations for registration.

**Example Scenario**:
```
Tournament: "Winter Series"
Brackets: 2.5, 3.0, 3.5

Admin Configuration:
├── 2.5 Bracket
│   ├── [✓] Men's Doubles
│   ├── [✓] Women's Doubles
│   ├── [✓] Mixed Doubles
│   ├── [ ] Men's Singles (disabled)
│   └── [ ] Women's Singles (disabled)
├── 3.0 Bracket
│   ├── [✓] Men's Doubles
│   ├── [✓] Women's Doubles
│   ├── [✓] Mixed Doubles
│   ├── [✓] Men's Singles
│   └── [✓] Women's Singles
└── 3.5 Bracket
    ├── [✓] Men's Doubles
    ├── [ ] Women's Doubles (disabled - not enough interest)
    ├── [✓] Mixed Doubles
    ├── [✓] Men's Singles
    └── [ ] Women's Singles (disabled)
```

**Implementation**:
- New model: `BracketGameTypeConfig`
- Fields: `bracketId`, `gameType`, `isEnabled`, `maxPlayers`
- UI: Admin tournament setup page with toggle grid
- Only enabled combinations appear in player registration UI

---

## Registration Constraints - Complete Matrix

### Club/Team Tournaments

| Constraint | Rule | Example |
|------------|------|---------|
| Club selection per stop | ONE club per stop | Stop 1: Club A, Stop 2: Club B ✓ |
| Club selection across stops | Different clubs allowed | Stop 1: Club A, Stop 2: Club A ✓ |
| Bracket selection per stop | ONE bracket per stop | Stop 1: 3.0 only ✓ |
| Bracket selection across stops | Different brackets allowed | Stop 1: 3.0, Stop 2: 3.5 ✓ |
| Game type selection | ALL game types auto-included | No selection - all 6 included ✓ |
| Multiple brackets same stop | NOT allowed | Stop 1: 3.0 AND 3.5 ✗ |

### Individual Tournaments

| Constraint | Rule | Example |
|------------|------|---------|
| Game type selection | Max 3 per gender | MD + Mixed + Singles ✓ |
| Bracket per game type | ONE bracket per game type | 3.0 MD, 3.5 Singles ✓ |
| Multiple brackets same game | NOT allowed | 3.0 MD AND 3.5 MD ✗ |
| Club selection | N/A - no clubs | - |

---

## Waitlist Rules - Complete Logic

### Rule 1: One Waitlist Entry Per Stop/GameType/Bracket Combination

**Valid Waitlist Combinations**:
- ✅ Stop 1, Men's Doubles, 3.0
- ✅ Stop 1, Singles, 3.5
- ✅ Stop 2, Men's Doubles, 4.0

**Invalid (Blocked)**:
- ❌ Stop 1, Men's Doubles, 3.0 AND Stop 1, Men's Doubles, 3.5
  - Reason: Same stop, same game type, different bracket
  - Player must choose one bracket per game type per stop

### Rule 2: Cannot Join Waitlist if Already Registered for Same Stop/GameType

**Scenario**: Player registered for Stop 1, Men's Doubles, 3.5
- ❌ CANNOT join waitlist for Stop 1, Men's Doubles, 3.0
- ✅ CAN join waitlist for Stop 1, Mixed Doubles, 3.0 (different game type)
- ✅ CAN join waitlist for Stop 2, Men's Doubles, 3.0 (different stop)

**Validation Logic**:
```typescript
// Before allowing waitlist join
const existingRegistration = await prisma.tournamentRegistration.findFirst({
  where: {
    playerId,
    tournamentId,
    status: 'REGISTERED',
    // Check if registered for same stop + game type
    selectedStopIds: { has: stopId },
    selectedBrackets: {
      some: {
        gameType: requestedGameType // e.g., "MENS_DOUBLES"
      }
    }
  }
});

if (existingRegistration) {
  throw new Error("Already registered for this game type at this stop");
}
```

### Rule 3: Club Restriction for Team Tournaments

**Scenario**: Team tournament, player registered for Stop 1, Club A, 3.0
- ❌ CANNOT register/waitlist for Stop 1, Club B, any bracket
- ✅ CAN register/waitlist for Stop 2, Club B, any bracket

**Validation**: One club per stop (enforced in registration and waitlist).

---

## Capacity Management - Roster-Based

### Capacity Calculation

**Count**: `StopTeamPlayer` records (roster entries only)

**Query Example**:
```typescript
const currentCapacity = await prisma.stopTeamPlayer.count({
  where: {
    stopId: 'stop-1',
    team: {
      bracketId: '3.0',
      clubId: 'club-a'
    }
  }
});

const maxCapacity = await prisma.stopBracketCapacity.findUnique({
  where: {
    stopId_bracketId_clubId: {
      stopId: 'stop-1',
      bracketId: '3.0',
      clubId: 'club-a'
    }
  }
});

const isFull = currentCapacity >= maxCapacity.maxPlayers;
```

### Capacity Changes Trigger Waitlist Promotion

**Events that free capacity**:
1. Player withdrawal (with refund if >24hr before start)
2. Admin removes player from roster
3. Admin moves player to different bracket (frees spot in old bracket)

**Auto-Promotion Flow**:
```typescript
async function onRosterEntryRemoved(stopId, bracketId, clubId) {
  // Check capacity
  const currentCount = await getCapacity(stopId, bracketId, clubId);
  const maxCount = await getMaxCapacity(stopId, bracketId, clubId);

  if (currentCount < maxCount) {
    // Find next person on waitlist
    const nextInLine = await prisma.stopBracketWaitlist.findFirst({
      where: {
        stopId,
        bracketId,
        clubId,
        status: 'ACTIVE'
      },
      orderBy: { position: 'asc' }
    });

    if (nextInLine) {
      // Promote them
      await promoteFromWaitlist(nextInLine.id);
    }
  }
}
```

---

## Payment & Registration State Management

### Registration States

**State 1: Payment Pending (Reservation)**
- TournamentRegistration created
- `paymentStatus = PENDING`
- `status = REGISTERED`
- RegistrationStopPayment records created (PENDING)
- **NO roster entry yet** (StopTeamPlayer not created)
- **COUNTS toward capacity** (spot reserved)

**State 2: Payment Confirmed**
- Stripe webhook fires
- `paymentStatus = PAID`
- Create StopTeamPlayer records (roster entries)
- Send confirmation email

**State 3: Payment Failed**
- Stripe webhook fires with failure
- `paymentStatus = FAILED`
- Delete RegistrationStopPayment records
- Delete TournamentRegistration
- **Release capacity** (spot available again)
- Trigger waitlist promotion if applicable

### Race Condition Prevention

**Scenario**: Last spot available, two players click register simultaneously

**Solution (Option C - Reserve spot immediately)**:
```typescript
// In registration endpoint, BEFORE Stripe checkout
await prisma.$transaction(async (tx) => {
  // 1. Check capacity (with lock)
  const currentCount = await tx.stopTeamPlayer.count({
    where: { stopId, bracketId, clubId }
  });

  // 2. Count PENDING registrations (reserved spots)
  const pendingCount = await tx.tournamentRegistration.count({
    where: {
      tournamentId,
      paymentStatus: 'PENDING',
      selectedStopIds: { has: stopId },
      selectedBrackets: { some: { id: bracketId } }
    }
  });

  const totalOccupied = currentCount + pendingCount;

  if (totalOccupied >= maxCapacity) {
    throw new Error("This bracket is now full");
  }

  // 3. Create registration with PENDING status (reserves spot)
  const registration = await tx.tournamentRegistration.create({
    data: {
      tournamentId,
      playerId,
      status: 'REGISTERED',
      paymentStatus: 'PENDING',
      selectedStopIds: [stopId],
      selectedBracketIds: [bracketId],
      selectedClubId: clubId
    }
  });

  // 4. Create payment records
  await tx.registrationStopPayment.create({
    data: {
      registrationId: registration.id,
      stopId,
      bracketId,
      amountPaid: calculatedAmount,
      paymentStatus: 'PENDING'
    }
  });
});

// 5. Now create Stripe checkout
const checkoutSession = await stripe.checkout.sessions.create({
  // ... checkout config
});

return { checkoutUrl: checkoutSession.url };
```

**Cleanup on Payment Failure**:
```typescript
// In Stripe webhook handler
if (event.type === 'checkout.session.failed') {
  // Release the reserved spot
  await prisma.tournamentRegistration.delete({
    where: { id: registrationId }
  });

  // Trigger waitlist promotion
  await checkAndPromoteWaitlist(stopId, bracketId, clubId);
}
```

---

## Admin Bracket Transfer - Complete Flow

### UI: Drag & Drop on Roster Page

**Mockup**:
```
Stop 1 Rosters - Club A

[3.0 Bracket] (11/12 capacity)
├── John Smith
├── Jane Doe
└── Bob Johnson [draggable]

[3.5 Bracket] (9/12 capacity)
├── Alice Williams
└── [drop zone]

[4.0 Bracket] (12/12 FULL)
├── Mike Davis
└── Sarah Miller [cannot drag to full bracket]
```

**Transfer Logic**:
```typescript
async function transferPlayerBracket(
  playerId: string,
  stopId: string,
  fromBracketId: string,
  toBracketId: string,
  clubId: string
) {
  await prisma.$transaction(async (tx) => {
    // 1. Check destination capacity
    const destCount = await tx.stopTeamPlayer.count({
      where: {
        stopId,
        team: { bracketId: toBracketId, clubId }
      }
    });

    const destMax = await getMaxCapacity(stopId, toBracketId, clubId);

    if (destCount >= destMax) {
      throw new Error(`Cannot move to ${toBracketId} - bracket is full`);
    }

    // 2. Find existing roster entry
    const existingEntry = await tx.stopTeamPlayer.findFirst({
      where: {
        stopId,
        playerId,
        team: { bracketId: fromBracketId, clubId }
      }
    });

    if (!existingEntry) {
      throw new Error("Player not found in source bracket");
    }

    // 3. Find destination team
    const destTeam = await tx.team.findFirst({
      where: {
        tournamentId,
        bracketId: toBracketId,
        clubId
      }
    });

    // 4. Delete old entry
    await tx.stopTeamPlayer.delete({
      where: {
        stopId_teamId_playerId: {
          stopId,
          teamId: existingEntry.teamId,
          playerId
        }
      }
    });

    // 5. Create new entry
    await tx.stopTeamPlayer.create({
      data: {
        stopId,
        teamId: destTeam.id,
        playerId
      }
    });

    // 6. Update registration record
    await tx.tournamentRegistration.updateMany({
      where: {
        playerId,
        tournamentId,
        selectedStopIds: { has: stopId }
      },
      data: {
        // Update bracket selection in JSON
        selectedBrackets: updateBracketSelection(fromBracketId, toBracketId)
      }
    });
  });

  // 7. Check if source bracket now has opening → promote from waitlist
  await checkAndPromoteWaitlist(stopId, fromBracketId, clubId);

  // 8. Log admin action
  await logAdminAction({
    adminId,
    action: 'PLAYER_BRACKET_TRANSFER',
    details: { playerId, stopId, fromBracketId, toBracketId }
  });
}
```

---

## Edge Case Resolutions - Final Decisions

| # | Edge Case | Resolution | Status |
|---|-----------|------------|--------|
| 1 | Admin move scope | Per-stop only (manual for each stop) | ✅ Confirmed |
| 2 | Multiple brackets same game type | NOT allowed - validation blocks | ✅ Confirmed |
| 3 | Cascade waitlist promotions | Auto-promote on any capacity opening | ✅ Confirmed |
| 4 | Waitlist + existing registration | Cannot waitlist for registered game type | ✅ Confirmed |
| 5 | Payment pending race condition | Reserve spot immediately (Option C) | ✅ Confirmed |
| 6 | Admin move + waitlist | OK - separate stop entries | ✅ Confirmed |
| 7 | Withdraw after admin move | Opens current bracket (3.5), not old (3.0) | ✅ Confirmed |
| 8 | Concurrent admin moves | Database transaction lock prevents | ✅ Confirmed |
| 9 | Waitlist notification + concurrent reg | Re-check capacity, keep position if still full | ✅ Confirmed |
| 10 | Add stop mid-tournament | Players can register separately for new stop | ✅ Confirmed |

---

## Database Schema Requirements - Final

### New Models Required

#### 1. BracketGameTypeConfig
```prisma
model BracketGameTypeConfig {
  id           String            @id @default(cuid())
  bracketId    String
  gameType     GameType          // MENS_DOUBLES, WOMENS_DOUBLES, MIXED, MENS_SINGLES, WOMENS_SINGLES
  isEnabled    Boolean           @default(true)
  maxPlayers   Int?              // Per game type limit (optional override)

  bracket      TournamentBracket @relation(fields: [bracketId], references: [id], onDelete: Cascade)

  @@unique([bracketId, gameType])
  @@index([bracketId])
}

enum GameType {
  MENS_DOUBLES
  WOMENS_DOUBLES
  MIXED_DOUBLES_1      // Team tournaments only
  MIXED_DOUBLES_2      // Team tournaments only
  MIXED_DOUBLES        // Individual tournaments
  MENS_SINGLES
  WOMENS_SINGLES
}
```

#### 2. StopBracketCapacity (unchanged from previous)
```prisma
model StopBracketCapacity {
  id           String            @id @default(cuid())
  stopId       String
  bracketId    String
  clubId       String?           // null for individual tournaments
  maxPlayers   Int

  stop         Stop              @relation(fields: [stopId], references: [id], onDelete: Cascade)
  bracket      TournamentBracket @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  club         Club?             @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@unique([stopId, bracketId, clubId])
}
```

#### 3. Updated TournamentRegistration
```prisma
model TournamentRegistration {
  // ... existing fields ...

  // NEW: Selection tracking
  selectedClubId        String?              // Required for team tournaments
  selectedStopIds       String[]             // Array of stop IDs

  // NEW: Bracket selections stored as JSON
  // Format: [{ stopId, bracketId, gameTypes: [GameType] }]
  selectedBrackets      Json

  // Example selectedBrackets:
  // Team tournament: [
  //   { stopId: "stop1", bracketId: "3.0", clubId: "clubA", gameTypes: ["ALL"] },
  //   { stopId: "stop2", bracketId: "3.5", clubId: "clubB", gameTypes: ["ALL"] }
  // ]
  //
  // Individual tournament: [
  //   { stopId: "stop1", bracketId: "3.0-mens-doubles", gameTypes: ["MENS_DOUBLES"] },
  //   { stopId: "stop1", bracketId: "3.5-mixed", gameTypes: ["MIXED_DOUBLES"] }
  // ]
}
```

#### 4. StopBracketWaitlist (redesigned)
```prisma
model StopBracketWaitlist {
  id                    String              @id @default(cuid())
  tournamentId          String
  stopId                String
  bracketId             String
  gameType              GameType            // Specific game type they're waiting for
  clubId                String?             // For team tournaments
  playerId              String

  position              Int                 // Recalculated when entries removed
  joinedAt              DateTime            @default(now())

  status                WaitlistStatus      @default(ACTIVE)
  notifiedAt            DateTime?
  notificationExpiresAt DateTime?           // 8 hours from notifiedAt
  registeredAt          DateTime?
  expiredAt             DateTime?
  removedAt             DateTime?

  tournament            Tournament          @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  stop                  Stop                @relation(fields: [stopId], references: [id], onDelete: Cascade)
  bracket               TournamentBracket   @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  club                  Club?               @relation(fields: [clubId], references: [id], onDelete: Cascade)
  player                Player              @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([stopId, bracketId, gameType, clubId, playerId])
  @@index([stopId, bracketId, gameType, clubId, status, position])
}
```

---

## Implementation Priority - Ready to Start

### Phase 1: Database Schema (Start Immediately) ✅
1. Create new enums (GameType, PricingModel)
2. Create new models (BracketGameTypeConfig, StopBracketCapacity, StopBracketWaitlist)
3. Update existing models (Tournament, Stop, TournamentBracket, TournamentRegistration)
4. Create migrations
5. Test migrations on dev database

**Estimated Time**: 1.5 weeks
**Status**: READY TO BEGIN

---

## Summary - All Requirements Finalized ✅

- ✅ Tournament type definitions clear
- ✅ Registration constraints documented
- ✅ Waitlist logic complete
- ✅ Capacity management finalized
- ✅ Payment flow designed
- ✅ Admin tools specified
- ✅ Edge cases resolved
- ✅ Database schema ready
- ✅ No remaining gaps in logic

**Ready for implementation!** 🚀
