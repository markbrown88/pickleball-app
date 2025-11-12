# Phase 1: Database Schema Migration - Complete Instructions

## Overview
We've prepared a complete SQL migration to enhance the registration system. This adds all the necessary database tables and fields for:
- Flexible pricing models
- Multi-stop/bracket registration
- Per-stop/bracket capacity limits
- Granular waitlist system
- Payment tracking

---

## Step-by-Step Instructions

### Step 1: Run the SQL Migration in Supabase

1. Open your Supabase project
2. Go to **SQL Editor**
3. Open the file: [SUPABASE_MIGRATION.sql](SUPABASE_MIGRATION.sql)
4. Copy and paste the entire SQL into the Supabase SQL Editor
5. Click **Run**
6. Wait for completion (should take ~10-15 seconds)
7. Check the verification queries at the end to confirm all tables were created

**What this does:**
- Creates 2 new ENUM types (`PricingModel`, `GameType`)
- Adds fields to 4 existing tables (`Tournament`, `Stop`, `TournamentBracket`, `TournamentRegistration`)
- Creates 6 new tables (`StopPricing`, `BracketPricing`, `BracketGameTypeConfig`, `StopBracketCapacity`, `StopBracketWaitlist`, `RegistrationStopPayment`)
- Adds all necessary indexes for performance

---

### Step 2: Update Your Prisma Schema File

**Option A: Manual Update** (Recommended if comfortable with schema files)

Open [SCHEMA_CHANGES.md](SCHEMA_CHANGES.md) and follow the step-by-step instructions to add:
1. New enums (Step 1)
2. Tournament model updates (Step 2)
3. Stop model updates (Step 3)
4. TournamentBracket model updates (Step 4)
5. TournamentRegistration model updates (Step 5)
6. Player and Club model relations (Steps 6-7)
7. New models (Step 8)

**Option B: Use the Update Script** (If Python is available)

```bash
cd c:/Users/markb/pickleball-app
python update-schema.py
```

**Option C: Introspect from Database** (Simplest but may need manual cleanup)

```bash
npx prisma db pull
```

This will update your `schema.prisma` based on the current database structure. You may need to manually:
- Add comments
- Fix relation names
- Reorder models for readability

---

### Step 3: Generate Prisma Client

After your schema file is updated, regenerate the Prisma client:

```bash
npx prisma generate
```

This creates TypeScript types for all the new models and fields.

---

### Step 4: Verify Everything Works

Run these commands to verify:

```bash
# Format the schema
npx prisma format

# Validate the schema
npx prisma validate

# Check for any drift between schema and database
npx prisma migrate status
```

If there's drift, you can create a baseline migration:

```bash
npx prisma migrate dev --name baseline_registration_enhancement
```

---

## What Changed

### New ENUMs:
- **PricingModel**: TOURNAMENT_WIDE | PER_STOP | PER_BRACKET | PER_STOP_PER_BRACKET
- **GameType**: MENS_DOUBLES | WOMENS_DOUBLES | MIXED_DOUBLES_1 | MIXED_DOUBLES_2 | MIXED_DOUBLES | MENS_SINGLES | WOMENS_SINGLES

### Updated Tables:
| Table | New Fields | Purpose |
|-------|------------|---------|
| Tournament | pricingModel | Determines how pricing is calculated |
| Stop | registrationDeadline, isRegistrationClosed, maxPlayersPerBracket | Per-stop registration control |
| TournamentBracket | gameType, skillLevel | Categorize brackets for registration UI |
| TournamentRegistration | selectedClubId, selectedStopIds, selectedBrackets, totalAmountPaid | Track player selections |

### New Tables:
| Table | Purpose |
|-------|---------|
| StopPricing | Store pricing per stop |
| BracketPricing | Store pricing per bracket (and optionally per stop) |
| BracketGameTypeConfig | Enable/disable specific game types per bracket |
| StopBracketCapacity | Set capacity limits per stop/bracket/club combo |
| StopBracketWaitlist | Granular waitlist per stop/bracket/gameType/club |
| RegistrationStopPayment | Track individual stop payments |

---

## TypeScript Type Examples

After generating Prisma client, you'll have these new types:

```typescript
import { PricingModel, GameType, Prisma } from '@prisma/client';

// Create tournament with pricing model
const tournament = await prisma.tournament.create({
  data: {
    name: "Summer League 2025",
    pricingModel: PricingModel.PER_STOP,
    // ... other fields
  }
});

// Create stop with capacity limit
const stop = await prisma.stop.create({
  data: {
    name: "Stop 1",
    tournamentId: tournament.id,
    registrationDeadline: new Date('2025-11-15'),
    isRegistrationClosed: false,
    maxPlayersPerBracket: 12,
    // ... other fields
  }
});

// Create bracket with game type
const bracket = await prisma.tournamentBracket.create({
  data: {
    name: "3.0 Men's Doubles",
    tournamentId: tournament.id,
    gameType: GameType.MENS_DOUBLES,
    skillLevel: "3.0",
  }
});

// Enable/disable game types for bracket
await prisma.bracketGameTypeConfig.create({
  data: {
    bracketId: bracket.id,
    gameType: GameType.MENS_DOUBLES,
    isEnabled: true,
    maxPlayers: 16,
  }
});

// Set capacity for stop/bracket/club combo
await prisma.stopBracketCapacity.create({
  data: {
    stopId: stop.id,
    bracketId: bracket.id,
    clubId: club.id,
    maxPlayers: 12,
  }
});

// Register player with selections
const registration = await prisma.tournamentRegistration.create({
  data: {
    tournamentId: tournament.id,
    playerId: player.id,
    selectedClubId: club.id,
    selectedStopIds: [stop1.id, stop2.id],
    selectedBrackets: {
      [stop1.id]: { bracketId: "3.0", gameTypes: ["MENS_DOUBLES"] },
      [stop2.id]: { bracketId: "3.5", gameTypes: ["MIXED_DOUBLES"] }
    },
    paymentStatus: "PENDING",
  }
});

// Add to waitlist
await prisma.stopBracketWaitlist.create({
  data: {
    tournamentId: tournament.id,
    stopId: stop.id,
    bracketId: bracket.id,
    gameType: GameType.MENS_DOUBLES,
    clubId: club.id,
    playerId: player.id,
    position: 1,
    status: "ACTIVE",
  }
});
```

---

## Rollback Plan

If you need to rollback:

### In Supabase:
```sql
-- Drop new tables
DROP TABLE IF EXISTS "RegistrationStopPayment" CASCADE;
DROP TABLE IF EXISTS "StopBracketWaitlist" CASCADE;
DROP TABLE IF EXISTS "StopBracketCapacity" CASCADE;
DROP TABLE IF EXISTS "BracketGameTypeConfig" CASCADE;
DROP TABLE IF EXISTS "BracketPricing" CASCADE;
DROP TABLE IF EXISTS "StopPricing" CASCADE;

-- Drop new columns
ALTER TABLE "TournamentRegistration"
DROP COLUMN IF EXISTS "selectedClubId",
DROP COLUMN IF EXISTS "selectedStopIds",
DROP COLUMN IF EXISTS "selectedBrackets",
DROP COLUMN IF EXISTS "totalAmountPaid";

ALTER TABLE "TournamentBracket"
DROP COLUMN IF EXISTS "gameType",
DROP COLUMN IF EXISTS "skillLevel";

ALTER TABLE "Stop"
DROP COLUMN IF EXISTS "registrationDeadline",
DROP COLUMN IF EXISTS "isRegistrationClosed",
DROP COLUMN IF EXISTS "maxPlayersPerBracket";

ALTER TABLE "Tournament"
DROP COLUMN IF EXISTS "pricingModel";

-- Drop new types
DROP TYPE IF EXISTS "GameType";
DROP TYPE IF EXISTS "PricingModel";
```

### Restore schema.prisma:
```bash
cp prisma/schema.prisma.backup prisma/schema.prisma
npx prisma generate
```

---

## Testing Checklist

After migration, verify:
- [ ] All 6 new tables exist in Supabase
- [ ] All new columns exist on updated tables
- [ ] All foreign keys are correct
- [ ] All indexes are created
- [ ] Prisma schema is updated
- [ ] Prisma client regenerated
- [ ] TypeScript types are available
- [ ] No errors in application build

---

## Next Steps

Once Phase 1 is complete, move to:

**Phase 2: Tournament Setup UI** (1.5 weeks)
- Update admin UI to configure pricing models
- Add game type enable/disable toggles
- Add capacity limit settings per stop/bracket
- Test all pricing configurations

**Phase 2.5: Background Jobs** (1 week)
- Set up cron infrastructure
- Implement stop auto-closure
- Implement waitlist expiration checking
- Implement auto-promotion logic

**Phase 3: Player Registration UI** (2.5 weeks)
- Build multi-stop/bracket selection UI
- Implement real-time pricing calculation
- Add club selection for team tournaments
- Integrate with Stripe checkout

---

## Support

If you encounter issues:

1. **Schema validation errors**: Check that all relation names match
2. **Type errors after migration**: Run `npx prisma generate` again
3. **Foreign key errors**: Verify table names match exactly (case-sensitive)
4. **Index errors**: Check for name conflicts with existing indexes

---

## Summary

✅ **SQL Migration Ready**: [SUPABASE_MIGRATION.sql](SUPABASE_MIGRATION.sql)
✅ **Schema Changes Documented**: [SCHEMA_CHANGES.md](SCHEMA_CHANGES.md)
✅ **Update Script Available**: [update-schema.py](update-schema.py)
✅ **Rollback Plan Included**: See above

**Estimated Time**: 15-30 minutes to complete Phase 1

**Ready to proceed?** Run the SQL migration in Supabase, update your Prisma schema, and you're ready for Phase 2!
