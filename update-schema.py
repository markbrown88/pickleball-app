#!/usr/bin/env python3
"""
Script to update Prisma schema with registration system enhancements
"""

import re

# Read the current schema
with open('prisma/schema.prisma', 'r') as f:
    schema = f.read()

# Step 1: Add new enums after WaitlistStatus
enum_addition = '''
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
'''

# Find the position after WaitlistStatus enum
waitlist_pattern = r'(enum WaitlistStatus \{[^}]+\})\n\n(/// \*\n/// \* ---------- Club Registration ----------)'
schema = re.sub(waitlist_pattern, r'\1\n' + enum_addition + r'\n\2', schema)

# Step 2: Update Tournament model - add pricingModel field and relations
tournament_pattern = r'(  isWaitlistEnabled      Boolean                  @default\(true\))\n\n(  CaptainInvite)'
tournament_addition = '''
  // NEW: Flexible pricing configuration
  pricingModel          PricingModel         @default(TOURNAMENT_WIDE)

  '''
schema = re.sub(tournament_pattern, r'\1\n' + tournament_addition + r'\2', schema)

# Add Tournament relations
tournament_relations_pattern = r'(  waitlist               TournamentWaitlist\[\])\n(\})'
tournament_relations_addition = '''
  stopPricing           StopPricing[]
  bracketPricing        BracketPricing[]
  stopBracketWaitlist   StopBracketWaitlist[]
'''
schema = re.sub(tournament_relations_pattern, r'\1\n' + tournament_relations_addition + r'\2', schema)

# Step 3: Update Stop model - add registration fields and relations
stop_pattern = r'(  lineupDeadline DateTime\?                @db\.Timestamptz\(6\) // Deadline for captain lineup submission)\n(  Lineup)'
stop_addition = '''
  // NEW: Per-stop registration settings
  registrationDeadline  DateTime?                @db.Timestamptz(6)  // Stop-specific deadline
  isRegistrationClosed  Boolean                  @default(false)     // Auto-set when past endAt
  maxPlayersPerBracket  Int?                     // Default capacity for all brackets at this stop

  '''
schema = re.sub(stop_pattern, r'\1\n' + stop_addition + r'\2', schema)

# Add Stop relations
stop_relations_pattern = r'(  StopTeamPlayer StopTeamPlayer\[\] @relation\("StopRoster"\))\n\n(  @@index)'
stop_relations_addition = '''
  bracketCapacities     StopBracketCapacity[]
  waitlistEntries       StopBracketWaitlist[]
  stopPricing           StopPricing[]
  bracketPricing        BracketPricing[]
  registrationStopPayments RegistrationStopPayment[]

  '''
schema = re.sub(stop_relations_pattern, r'\1\n' + stop_relations_addition + r'\2', schema)

# Add Stop index
stop_index_pattern = r'(  @@index\(\[tournamentId\], map: "ix_Stop_tournamentId"\))\n(\})'
stop_index_addition = '''
  @@index([isRegistrationClosed, endAt])  // For finding open stops
'''
schema = re.sub(stop_index_pattern, r'\1\n' + stop_index_addition + r'\2', schema)

# Step 4: Update TournamentBracket model
bracket_pattern = r'(  idx          Int        @default\(0\))\n(  teams)'
bracket_addition = '''
  gameType     GameType?  // e.g., MENS_DOUBLES, MIXED_DOUBLES
  skillLevel   String?    // e.g., "3.0", "3.5", "4.0", "4.5"
  '''
schema = re.sub(bracket_pattern, r'\1\n' + bracket_addition + r'\2', schema)

# Add TournamentBracket relations
bracket_relations_pattern = r'(  games        Game\[\]     // Games that belong to this bracket \(for DOUBLE_ELIMINATION_CLUBS\))\n(  tournament)'
bracket_relations_addition = '''
  gameTypeConfigs      BracketGameTypeConfig[]
  bracketPricing       BracketPricing[]
  capacityLimits       StopBracketCapacity[]
  waitlistEntries      StopBracketWaitlist[]
  registrationStopPayments RegistrationStopPayment[]
  '''
schema = re.sub(bracket_relations_pattern, r'\1\n' + bracket_relations_addition + r'\2', schema)

# Step 5: Update TournamentRegistration model
registration_pattern = r'(  amountPaid        Int\?                      // in cents)\n\n(  tournament)'
registration_addition = '''
  // NEW: Selection tracking
  selectedClubId        String?              // Required for team tournaments
  selectedStopIds       String[]             // Array of stop IDs
  selectedBrackets      Json?                // Detailed bracket selections per stop
  totalAmountPaid       Int?                 // Total across all stops/brackets (in cents)

  '''
schema = re.sub(registration_pattern, r'\1\n' + registration_addition + r'\2', schema)

# Add TournamentRegistration relations
registration_relations_pattern = r'(  player            Player                    @relation\(fields: \[playerId\], references: \[id\], onDelete: Cascade\))\n\n(  @@unique)'
registration_relations_addition = '''
  selectedClub          Club?                    @relation("SelectedClub", fields: [selectedClubId], references: [id])
  stopPayments          RegistrationStopPayment[]

  '''
schema = re.sub(registration_relations_pattern, r'\1\n' + registration_relations_addition + r'\2', schema)

# Add TournamentRegistration indexes
registration_index_pattern = r'(  @@index\(\[playerId\]\))\n(\})'
registration_index_addition = '''
  @@index([selectedClubId])
  @@index([paymentStatus])
'''
schema = re.sub(registration_index_pattern, r'\1\n' + registration_index_addition + r'\2', schema)

# Step 6: Update Player model - add relations
player_pattern = r'(  tournamentWaitlist     TournamentWaitlist\[\])\n\n(  @@index)'
player_addition = '''
  stopBracketWaitlist    StopBracketWaitlist[]

  '''
schema = re.sub(player_pattern, r'\1\n' + player_addition + r'\2', schema)

# Step 7: Update Club model - add relations
club_pattern = r'(  director           Player\?             @relation\("ClubDirector", fields: \[directorId\], references: \[id\], onDelete: SetNull\))\n(\})'
club_addition = '''
  stopBracketCapacities  StopBracketCapacity[]
  stopBracketWaitlist    StopBracketWaitlist[]
  tournamentRegistrations TournamentRegistration[] @relation("SelectedClub")
'''
schema = re.sub(club_pattern, r'\1\n' + club_addition + r'\2', schema)

# Step 8: Add new models after TournamentWaitlist
new_models = '''

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
'''

# Find the end of the TournamentWaitlist model and insert new models
waitlist_model_pattern = r'(  @@index\(\[tournamentId, status, position\]\)\n\})\n\n(enum RegistrationPlayerStatus)'
schema = re.sub(waitlist_model_pattern, r'\1' + new_models + r'\n\n\2', schema)

# Write the updated schema
with open('prisma/schema.prisma', 'w') as f:
    f.write(schema)

print("✅ Schema updated successfully!")
print("Next steps:")
print("1. Run: npx prisma format")
print("2. Run: npx prisma validate")
print("3. Run: npx prisma migrate dev --name add_registration_enhancements")
