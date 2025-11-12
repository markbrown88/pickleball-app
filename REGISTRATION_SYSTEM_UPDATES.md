# Registration System Updates - Based on Clarifications

**Date**: 2025-11-05
**Status**: Requirements Finalized

---

## Critical Changes from Original Plan

### 1. Waitlist System - Complete Redesign Required

**Current Implementation**:
- ❌ Tournament-level waitlist only
- ❌ 24-hour notification window
- ❌ Single waitlist for entire tournament

**New Requirements**:
- ✅ **Per stop/bracket/club** waitlist
- ✅ **8-hour** notification window (not 24)
- ✅ Automatic cascade to next person if time expires
- ✅ Email notifications with registration link

**Impact**: This is a MAJOR change requiring new database models and background job system.

---

### 2. Player Capacity Limits - Granular Implementation

**Current Implementation**:
- ✅ Tournament-level `maxPlayers` exists and works
- ❌ No per-stop limits
- ❌ No per-bracket limits
- ❌ No per-club limits

**New Requirements**:
- ✅ **For Team-Based Tournaments**: Capacity per stop/bracket/club combination
- ✅ **For Individual Tournaments**: Capacity per stop or whole tournament
- ✅ Separate waitlist for each capacity-limited unit

---

### 3. Registration Deadline - Per Stop

**Current Implementation**:
- ✅ Tournament has `registrationDeadline` field
- ❌ Stops don't have individual deadlines

**New Requirements**:
- ✅ Each stop has its own `registrationDeadline`
- ✅ Stops auto-close when `endAt < now` (past stops)
- ✅ Stops close when `registrationDeadline` reached

---

### 4. Refund Policy - Simplified

**Confirmed Rules**:
- ✅ More than 24 hours before tournament start: **FULL REFUND**
- ❌ Within 24 hours or after start: **NO REFUND**
- ❌ No partial refunds for multi-stop registrations

**Implementation**: Simple boolean check, no complex calculations needed.

---

### 5. Individual Tournament Roster Placement

**Confirmed Approach**:
- ❌ **Do NOT** auto-place individual tournament players into rosters
- ✅ Keep them in the **Registration tab** only
- ✅ Admins will manually build elimination brackets later

**Implementation**: Phase 5 (roster placement) only applies to team-based tournaments.

---

### 6. Admin Bracket Management

**New Requirement**:
- ✅ Drag-and-drop players between brackets on Roster page
- ✅ Admins can manually reassign player brackets after registration

**Implementation**: Add to Phase 6 (UI enhancements).

---

## Updated Database Schema Requirements

### NEW Model: StopBracketCapacity

```prisma
/// Per-stop, per-bracket capacity limits (team-based tournaments)
model StopBracketCapacity {
  id           String            @id @default(cuid())
  stopId       String
  bracketId    String
  clubId       String?           // null for individual tournaments
  maxPlayers   Int               // Max players for this stop/bracket/club combo

  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  stop         Stop              @relation(fields: [stopId], references: [id], onDelete: Cascade)
  bracket      TournamentBracket @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  club         Club?             @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@unique([stopId, bracketId, clubId])
  @@index([stopId])
  @@index([bracketId])
  @@index([clubId])
}
```

**Purpose**: Define capacity limits at the most granular level (stop × bracket × club).

**Example**:
- Stop 1, Men's Doubles, Club A: 12 players max
- Stop 1, Men's Doubles, Club B: 10 players max
- Stop 2, Mixed, Club A: 16 players max

---

### REDESIGNED Model: StopBracketWaitlist

```prisma
/// Waitlist redesigned to be per stop/bracket/club combination
model StopBracketWaitlist {
  id                    String              @id @default(cuid())
  tournamentId          String
  stopId                String
  bracketId             String
  clubId                String?             // null for individual tournaments
  playerId              String

  position              Int                 // Auto-calculated per stop/bracket/club combo
  joinedAt              DateTime            @default(now())

  status                WaitlistStatus      @default(ACTIVE)
  notifiedAt            DateTime?           // When spot-available email sent
  notificationExpiresAt DateTime?           // 8 hours after notifiedAt

  registeredAt          DateTime?           // When they completed registration
  removedAt             DateTime?
  expiredAt             DateTime?           // When their 8-hour window closed

  // Stored selections from when they joined waitlist
  desiredStopIds        String[]            // They may want multiple stops
  desiredBracketIds     String[]            // They may want multiple brackets

  tournament            Tournament          @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  stop                  Stop                @relation(fields: [stopId], references: [id], onDelete: Cascade)
  bracket               TournamentBracket   @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  club                  Club?               @relation(fields: [clubId], references: [id], onDelete: Cascade)
  player                Player              @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([stopId, bracketId, clubId, playerId])
  @@index([tournamentId, status])
  @@index([stopId, bracketId, clubId, status, position])  // For finding next in line
  @@index([playerId])
  @@index([notificationExpiresAt])  // For cron job to check expired notifications
  @@index([status, notificationExpiresAt])  // For finding expired notifications
}
```

**Key Changes**:
1. **Specific to stop/bracket/club combo** - Not tournament-wide
2. **8-hour expiration** - Changed from 24 hours
3. **Stores desired selections** - Player's full registration intent
4. **Expired status tracking** - Know when someone's window closed

---

### UPDATED Model: Stop

```prisma
model Stop {
  id                    String                   @id @default(cuid())
  name                  String
  createdAt             DateTime                 @default(now())
  tournamentId          String
  clubId                String?
  startAt               DateTime                 @db.Timestamptz(6)
  endAt                 DateTime?                @db.Timestamptz(6)
  updatedAt             DateTime                 @default(now()) @db.Timestamptz(6)
  eventManagerId        String?
  lineupDeadline        DateTime?                @db.Timestamptz(6)

  // NEW: Registration settings per stop
  registrationDeadline  DateTime?                @db.Timestamptz(6)  // Stop-specific deadline
  isRegistrationClosed  Boolean                  @default(false)     // Auto-set when past endAt
  maxPlayersPerBracket  Int?                     // Default capacity for all brackets at this stop

  Lineup                Lineup[]
  rounds                Round[]
  club                  Club?                    @relation(fields: [clubId], references: [id], onUpdate: NoAction)
  eventManager          Player?                  @relation("StopEventManager", fields: [eventManagerId], references: [id], onUpdate: NoAction)
  tournament            Tournament               @relation(fields: [tournamentId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  teams                 StopTeam[]
  StopTeamPlayer        StopTeamPlayer[]         @relation("StopRoster")

  // NEW: Relations
  bracketCapacities     StopBracketCapacity[]
  waitlistEntries       StopBracketWaitlist[]
  stopPricing           StopPricing[]
  bracketPricing        BracketPricing[]

  @@index([tournamentId])
  @@index([clubId])
  @@index([eventManagerId])
  @@index([endAt])
  @@index([startAt])
  @@index([tournamentId], map: "ix_Stop_tournamentId")
  @@index([isRegistrationClosed, endAt])  // For finding open stops
}
```

---

### UPDATED Model: TournamentBracket

```prisma
model TournamentBracket {
  id           String                   @id @default(cuid())
  tournamentId String
  name         String                   // e.g., "Men's Doubles", "Mixed", "3.5"
  idx          Int                      @default(0)
  gameType     String?                  // e.g., "SINGLES", "DOUBLES", "MIXED"
  skillLevel   String?                  // e.g., "3.0", "3.5", "4.0"

  teams        Team[]
  games        Game[]

  // NEW: Relations
  bracketPricing       BracketPricing[]
  capacityLimits       StopBracketCapacity[]
  waitlistEntries      StopBracketWaitlist[]

  tournament   Tournament               @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, name])
  @@index([tournamentId, idx], map: "TournamentBracket_tournamentId_idx")
}
```

**New Fields**:
- `gameType`: Identifies the type of game (singles, doubles, mixed)
- `skillLevel`: Identifies the skill level (3.0, 3.5, 4.0, etc.)

**Purpose**: Allows UI to group brackets by game type and let players select one skill level per game type.

---

## Updated Implementation Phases

### Phase 1: Database Schema Updates (1.5 weeks - INCREASED)

**Additional Tasks**:
1. ✅ Create `StopBracketCapacity` model
2. ✅ Redesign `StopBracketWaitlist` model (replace old `TournamentWaitlist`)
3. ✅ Add fields to `Stop` model (registrationDeadline, isRegistrationClosed, maxPlayersPerBracket)
4. ✅ Add fields to `TournamentBracket` model (gameType, skillLevel)
5. ✅ Create migration to convert existing tournament waitlist data (if any)
6. ✅ Add indexes for capacity checking and waitlist queries

**Complexity Increase**: Waitlist redesign is more complex than anticipated.

---

### Phase 2.5: Background Jobs & Cron System (NEW - 1 week)

**Priority**: CRITICAL - Required for waitlist automation

**Tasks**:
1. ✅ Set up cron job infrastructure (e.g., Vercel Cron, node-cron, or external service)
2. ✅ Create job: Check and close past stops (`endAt < now`)
   - Set `isRegistrationClosed = true`
   - Send notifications if needed
3. ✅ Create job: Check expired waitlist notifications (every hour)
   - Find entries where `status = NOTIFIED` and `notificationExpiresAt < now`
   - Mark as `EXPIRED`
   - Promote next person in line for that stop/bracket/club
4. ✅ Create job: Check upcoming registration deadlines
   - Send reminder emails 24 hours before deadline
5. ✅ Create service: Auto-promote from waitlist when spot opens
   - When registration withdrawn/rejected
   - Calculate capacity for that stop/bracket/club
   - If under capacity, promote first ACTIVE waitlist entry
   - Send email with 8-hour timer
6. ✅ Add logging and monitoring for all background jobs

**Deliverables**:
- Cron job setup
- Stop closure automation
- Waitlist expiration handler
- Auto-promotion service
- Email notification system

---

### Phase 3: Player Registration UI (2.5 weeks - INCREASED)

**Additional Complexity**:
1. ✅ Waitlist joining now requires selecting specific stop/bracket/club combinations
2. ✅ Show capacity per stop/bracket/club
3. ✅ Show waitlist position per stop/bracket/club
4. ✅ Handle "some selections full, some available" scenarios
5. ✅ Real-time capacity checking before payment

**New UI Requirements**:
- Capacity indicators: "8/12 spots filled" per stop/bracket/club
- Smart registration: "This combination is full - join waitlist?"
- Mixed registration: "Singles available, Doubles full - proceed with Singles only or join Doubles waitlist?"

---

### Phase 4: Payment Integration (2 weeks - UNCHANGED)

No changes - same as original plan.

---

### Phase 5: Automatic Roster Placement (1 week - DECREASED)

**Simplified Scope**:
- ✅ Only for team-based tournaments
- ❌ Skip individual tournaments (stay in registration tab)
- ✅ Create `TeamPlayer` for selected club/bracket
- ✅ Create `StopTeamPlayer` for each selected stop

**Deliverables**:
- Roster placement service (team tournaments only)
- Integration with payment webhook
- Removal logic on withdrawal/rejection

---

### Phase 6: Registration Management UI (1.5 weeks - INCREASED)

**Additional Features**:
1. ✅ Drag-and-drop bracket reassignment
2. ✅ Capacity monitoring dashboard
3. ✅ Waitlist management per stop/bracket/club
4. ✅ Bulk actions for waitlist promotion

**New Admin Views**:
- **Capacity Overview**: Visual grid showing capacity per stop/bracket/club
- **Waitlist Manager**: View and manage all waitlists with positions
- **Drag-Drop Roster**: Move players between brackets

---

## Updated Timeline

| Phase | Original | Updated | Priority | Change |
|-------|----------|---------|----------|--------|
| Phase 1: Database Schema | 1 week | **1.5 weeks** | CRITICAL | +0.5 weeks |
| Phase 2: Tournament Setup UI | 1.5 weeks | 1.5 weeks | CRITICAL | No change |
| **Phase 2.5: Background Jobs** | **N/A** | **1 week** | **CRITICAL** | **NEW** |
| Phase 3: Player Registration UI | 2 weeks | **2.5 weeks** | CRITICAL | +0.5 weeks |
| Phase 4: Payment Integration | 2 weeks | 2 weeks | HIGH | No change |
| Phase 5: Roster Placement | 1.5 weeks | **1 week** | CRITICAL | -0.5 weeks |
| Phase 6: Admin UI Enhancements | 1 week | **1.5 weeks** | MEDIUM | +0.5 weeks |
| Phase 7: Additional Features | 1 week | 1 week | LOW | No change |
| Phase 8: Testing & QA | 1 week | **1.5 weeks** | CRITICAL | +0.5 weeks |
| **TOTAL** | **11 weeks** | **13 weeks** | | **+2 weeks** |

**Critical Path**: Phases 1, 2, 2.5, 3, 4, 5, 8 = **11 weeks**

---

## Waitlist Flow - Detailed Diagram

### Scenario: Player Wants to Join Full Stop/Bracket

```
┌─────────────────────────────────────────────────────────────┐
│ Player attempts to register for Stop 1, Men's Doubles, Club A │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Check Capacity     │
         │ Current: 12/12     │
         └────────┬───────────┘
                  │ FULL
                  ▼
         ┌────────────────────┐
         │ Show Waitlist UI   │
         │ "Join Waitlist?"   │
         └────────┬───────────┘
                  │ Player clicks "Join Waitlist"
                  ▼
    ┌─────────────────────────────────────┐
    │ Create StopBracketWaitlist record   │
    │ - stopId, bracketId, clubId         │
    │ - position = (count + 1)            │
    │ - status = ACTIVE                   │
    │ - desiredStopIds = [stop1, stop2]   │
    │ - desiredBracketIds = [mens, mixed] │
    └─────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Send Email         │
         │ "You're on the     │
         │  waitlist (#3)"    │
         └────────────────────┘
```

### Scenario: Spot Opens Up

```
┌─────────────────────────────────────────────────────┐
│ Player withdraws from Stop 1, Men's Doubles, Club A │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Process Withdrawal │
         │ - Issue refund     │
         │ - Remove roster    │
         └────────┬───────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │ Check Waitlist                  │
    │ Find ACTIVE entries for:        │
    │ - Stop 1                        │
    │ - Men's Doubles                 │
    │ - Club A                        │
    │ ORDER BY position ASC           │
    └─────────────┬───────────────────┘
                  │ Found: Player #1 on waitlist
                  ▼
    ┌─────────────────────────────────┐
    │ Update Waitlist Entry           │
    │ - status = NOTIFIED             │
    │ - notifiedAt = now()            │
    │ - notificationExpiresAt =       │
    │   now() + 8 hours               │
    └─────────────┬───────────────────┘
                  │
                  ▼
         ┌────────────────────────────────┐
         │ Send Email                     │
         │ "A spot opened! Register by:   │
         │  [time] or you'll lose it"     │
         │  [Register Now Button]         │
         └────────────────────────────────┘
                  │
                  ├─────────────────┐
                  │                 │
    ┌─────────────▼──────┐  ┌──────▼─────────────┐
    │ Player registers   │  │ 8 hours pass       │
    │ within 8 hours     │  │ No registration    │
    └─────────┬──────────┘  └──────┬─────────────┘
              │                    │
              │                    ▼
              │         ┌──────────────────────┐
              │         │ Cron Job Runs        │
              │         │ - Mark as EXPIRED    │
              │         │ - expiredAt = now()  │
              │         └──────┬───────────────┘
              │                │
              │                ▼
              │         ┌──────────────────────┐
              │         │ Promote Next Person  │
              │         │ (repeat process)     │
              │         └──────────────────────┘
              │
              ▼
    ┌─────────────────────────────┐
    │ Registration Complete       │
    │ - status = REGISTERED       │
    │ - registeredAt = now()      │
    │ - Process payment           │
    │ - Add to roster             │
    └─────────────────────────────┘
```

---

## Critical Questions for Implementation

### 1. Waitlist Selection Granularity

**Question**: When joining the waitlist, does the player select:
- **Option A**: Individual stop/bracket/club combos (could be on multiple waitlists)
- **Option B**: Full registration intent (all desired stops/brackets), but waitlist per combo

**Example**:
Player wants: Stop 1 (Men's + Mixed) and Stop 2 (Men's + Mixed)
- Stop 1 Men's: Available ✓
- Stop 1 Mixed: FULL → Join waitlist
- Stop 2 Men's: Available ✓
- Stop 2 Mixed: Available ✓

**Question**: Should they:
- Register for available ones now, join waitlist for full ones?
- Join waitlist only, complete full registration when spot opens?

**Recommendation**: Allow **partial registration** - register for available, waitlist for full.

### 2. Capacity Calculation Method

**Question**: How is capacity counted for team-based tournaments?

**Options**:
- **Per roster**: Count `StopTeamPlayer` records for that stop/bracket/club
- **Per registration**: Count `TournamentRegistration` records with those selections
- **Hybrid**: Registration reserves spot, roster placement confirms it

**Recommendation**: Count **registrations with payment confirmed** - most accurate.

### 3. Waitlist Position Recalculation

**Question**: When someone is removed from waitlist (not expired), do we:
- **Option A**: Recalculate all positions (position 4 becomes 3, 5 becomes 4, etc.)
- **Option B**: Keep positions static (gaps in numbering)

**Current Code Bug**: Positions are NOT recalculated (line 214 TODO in code).

**Recommendation**: **Recalculate positions** when someone removed - easier for players to understand.

---

## Risk Assessment Updates

### NEW High-Risk Items:

1. **Waitlist Automation Complexity**: 8-hour timer + cascade promotion + cron jobs
   - *Mitigation*: Thorough testing, comprehensive logging, manual admin override

2. **Race Conditions in Capacity**: Multiple simultaneous registrations for last spot
   - *Mitigation*: Database transactions, optimistic locking, unique constraints

3. **Email Delivery Reliability**: Critical for waitlist notifications
   - *Mitigation*: Use reliable service (SendGrid/SES), retry logic, delivery tracking

### NEW Medium-Risk Items:

4. **Cron Job Reliability**: Vercel cron limitations in free tier
   - *Mitigation*: Consider external cron service (EasyCron), monitoring/alerts

5. **Time Zone Handling**: 8-hour windows across time zones
   - *Mitigation*: Store all times in UTC, display in user's local time

---

## Next Steps

1. ✅ **Review and approve** this updated plan
2. ✅ **Decide on critical questions** (waitlist granularity, capacity counting, position recalculation)
3. ✅ **Prioritize phases** - Full 13 weeks or just critical path (11 weeks)?
4. ✅ **Begin Phase 1** - Database schema updates

**Ready to start implementation?** Let me know which phase to begin with, or if you have more questions!
