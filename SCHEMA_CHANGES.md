# Prisma Schema Changes for Registration System Enhancement

## Overview
This document contains all the schema changes needed for Phase 1 of the registration system enhancement.

## Step 1: Add New Enums

Add these enums after `WaitlistStatus` enum (after line 684):

```prisma
/// *
/// * Tournament pricing models
enum PricingModel {
  TOURNAMENT_WIDE        // One price for everything
  PER_STOP               // Price per stop (club tournaments)
  PER_BRACKET            // Price per bracket/game type (individual tournaments)
  PER_STOP_PER_BRACKET   // Price per stop AND bracket combination
}

/// *
/// * Game types for registration and bracket configuration
enum GameType {
  MENS_DOUBLES
  WOMENS_DOUBLES
  MIXED_DOUBLES_1        // Team tournaments only
  MIXED_DOUBLES_2        // Team tournaments only
  MIXED_DOUBLES          // Individual tournaments
  MENS_SINGLES
  WOMENS_SINGLES
}
```

## Step 2: Update Tournament Model

Add these fields to the `Tournament` model (after line 158, after `isWaitlistEnabled`):

```prisma
  // NEW: Flexible pricing configuration
  pricingModel          PricingModel         @default(TOURNAMENT_WIDE)
```

Add these relations to the Tournament model (after line 172, after `waitlist`):

```prisma
  stopPricing           StopPricing[]
  bracketPricing        BracketPricing[]
  stopBracketWaitlist   StopBracketWaitlist[]
```

## Step 3: Update Stop Model

Add these fields to the `Stop` model (after line 216, after `lineupDeadline`):

```prisma
  // NEW: Per-stop registration settings
  registrationDeadline  DateTime?            @db.Timestamptz(6)  // Stop-specific deadline
  isRegistrationClosed  Boolean              @default(false)     // Auto-set when past endAt
  maxPlayersPerBracket  Int?                 // Default capacity for all brackets at this stop
```

Add these relations to the Stop model (after line 223, after `StopTeamPlayer`):

```prisma
  bracketCapacities     StopBracketCapacity[]
  waitlistEntries       StopBracketWaitlist[]
  stopPricing           StopPricing[]
  bracketPricing        BracketPricing[]
  registrationStopPayments RegistrationStopPayment[]
```

Add this index to Stop model (after existing indexes):

```prisma
  @@index([isRegistrationClosed, endAt])  // For finding open stops
```

## Step 4: Update TournamentBracket Model

Add these fields to the `TournamentBracket` model (after line 439, after `idx`):

```prisma
  gameType             GameType?            // e.g., MENS_DOUBLES, MIXED_DOUBLES
  skillLevel           String?              // e.g., "3.0", "3.5", "4.0", "4.5"
```

Add these relations to the TournamentBracket model (after line 442, after `tournament` relation):

```prisma
  gameTypeConfigs      BracketGameTypeConfig[]
  bracketPricing       BracketPricing[]
  capacityLimits       StopBracketCapacity[]
  waitlistEntries      StopBracketWaitlist[]
  registrationStopPayments RegistrationStopPayment[]
```

## Step 5: Update TournamentRegistration Model

Add these fields to the `TournamentRegistration` model (after line 566, after `amountPaid`):

```prisma
  // NEW: Selection tracking
  selectedClubId        String?              // Required for team tournaments
  selectedStopIds       String[]             // Array of stop IDs
  selectedBrackets      Json?                // Detailed bracket selections per stop

  // NEW: Detailed payment tracking
  totalAmountPaid       Int?                 // Total across all stops/brackets (in cents)
```

Add these relations to the TournamentRegistration model (after line 569, after `player` relation):

```prisma
  selectedClub          Club?                @relation(fields: [selectedClubId], references: [id])
  stopPayments          RegistrationStopPayment[]
```

Add this index to TournamentRegistration model (after existing indexes):

```prisma
  @@index([selectedClubId])
  @@index([paymentStatus])
```

## Step 6: Update Player Model

Add this relation to the Player model (after line 88, after `tournamentWaitlist`):

```prisma
  stopBracketWaitlist    StopBracketWaitlist[]
  clubRegistrations      TournamentRegistration[] @relation("SelectedClub")
```

## Step 7: Update Club Model

Add this relation to the Club model (after line 34, after `director` relation):

```prisma
  stopBracketCapacities  StopBracketCapacity[]
  stopBracketWaitlist    StopBracketWaitlist[]
  tournamentRegistrations TournamentRegistration[] @relation("SelectedClub")
```

## Step 8: Add New Models

Add these new models after the `TournamentWaitlist` model (after line 648):

```prisma
/// *
/// * ---------- Enhanced Registration System Models ----------

/// *
/// * Pricing configuration per stop
model StopPricing {
  id           String     @id @default(cuid())
  tournamentId String
  stopId       String
  cost         Int        // in cents
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  stop         Stop       @relation(fields: [stopId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, stopId])
  @@index([tournamentId])
  @@index([stopId])
}

/// *
/// * Pricing configuration per bracket (and optionally per stop)
model BracketPricing {
  id           String            @id @default(cuid())
  tournamentId String
  bracketId    String
  stopId       String?           // null = tournament-wide, set = per-stop pricing
  cost         Int               // in cents
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  tournament   Tournament        @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  bracket      TournamentBracket @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  stop         Stop?             @relation(fields: [stopId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, bracketId, stopId])
  @@index([tournamentId])
  @@index([bracketId])
  @@index([stopId])
}

/// *
/// * Game type configuration per bracket - enables/disables specific game types
model BracketGameTypeConfig {
  id           String            @id @default(cuid())
  bracketId    String
  gameType     GameType
  isEnabled    Boolean           @default(true)
  maxPlayers   Int?              // Per game type limit (optional override)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  bracket      TournamentBracket @relation(fields: [bracketId], references: [id], onDelete: Cascade)

  @@unique([bracketId, gameType])
  @@index([bracketId])
  @@index([bracketId, isEnabled])
}

/// *
/// * Capacity limits per stop/bracket/club combination
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
  @@index([stopId, bracketId])
}

/// *
/// * Waitlist redesigned to be per stop/bracket/gameType/club combination
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
  notifiedAt            DateTime?           // When spot-available email sent
  notificationExpiresAt DateTime?           // 8 hours from notifiedAt
  registeredAt          DateTime?           // When they completed registration
  expiredAt             DateTime?           // When their 8-hour window closed
  removedAt             DateTime?

  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  tournament            Tournament          @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  stop                  Stop                @relation(fields: [stopId], references: [id], onDelete: Cascade)
  bracket               TournamentBracket   @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  club                  Club?               @relation(fields: [clubId], references: [id], onDelete: Cascade)
  player                Player              @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([stopId, bracketId, gameType, clubId, playerId])
  @@index([tournamentId, status])
  @@index([stopId, bracketId, gameType, clubId, status, position])  // For finding next in line
  @@index([playerId])
  @@index([notificationExpiresAt])  // For cron job to check expired notifications
  @@index([status, notificationExpiresAt])  // For finding expired notifications
}

/// *
/// * Track individual stop/bracket payment records
model RegistrationStopPayment {
  id                    String                   @id @default(cuid())
  registrationId        String
  stopId                String
  bracketId             String?                  // null for club tournaments (pay for all brackets)

  amountPaid            Int                      // in cents
  paymentStatus         PaymentStatus            @default(PENDING)
  paymentId             String?                  // Stripe payment ID
  refundId              String?                  // Stripe refund ID
  paidAt                DateTime?
  refundedAt            DateTime?

  createdAt             DateTime                 @default(now())
  updatedAt             DateTime                 @updatedAt

  registration          TournamentRegistration   @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  stop                  Stop                     @relation(fields: [stopId], references: [id], onDelete: Cascade)
  bracket               TournamentBracket?       @relation(fields: [bracketId], references: [id], onDelete: Cascade)

  @@unique([registrationId, stopId, bracketId])
  @@index([registrationId])
  @@index([stopId])
  @@index([bracketId])
  @@index([paymentStatus])
}
```

## Migration Strategy

1. **Backup database** before applying changes
2. Add enums first (Step 1)
3. Update existing models (Steps 2-7)
4. Add new models (Step 8)
5. Run `npx prisma format` to format the schema
6. Run `npx prisma validate` to check for errors
7. Run `npx prisma migrate dev --name add_registration_enhancements` to create migration
8. Test migration on development database
9. Verify all relations are correct

## Data Migration Notes

- Existing `Tournament` records will default to `pricingModel = TOURNAMENT_WIDE`
- Existing `Stop` records will default to `isRegistrationClosed = false`
- Existing `TournamentRegistration` records will have `selectedClubId = null`, `selectedStopIds = []`, `selectedBrackets = null`
- Old `TournamentWaitlist` model can remain for backward compatibility (mark as deprecated)

## Testing Checklist

After migration:
- [ ] Create test tournament with TOURNAMENT_WIDE pricing
- [ ] Create test tournament with PER_STOP pricing
- [ ] Create test tournament with PER_BRACKET pricing
- [ ] Create test stop with capacity limits
- [ ] Create test bracket with game type configs
- [ ] Create test waitlist entry with new model
- [ ] Verify all foreign key constraints work
- [ ] Test cascade deletes

## Rollback Plan

If migration fails:
1. Run `npx prisma migrate resolve --rolled-back [migration-name]`
2. Restore database from backup
3. Review errors and fix schema issues
4. Retry migration
