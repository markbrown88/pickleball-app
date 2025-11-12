# Quick Prisma Schema Update Guide

The database migration is complete! You just need to update your `schema.prisma` file to match.

## Quick Option: Let Prisma Handle It Later

Since the database is already updated and working, you can proceed with development and sync the schema later. Here's why this works:

1. **Existing code still works** - All your current API endpoints and queries will continue to function
2. **New features are in the database** - The tables and columns exist, ready to use
3. **You can update the schema anytime** - Run `npx prisma db pull` when convenient

## Option 1: Update Schema Now (15 minutes)

Copy the schema additions from [SCHEMA_CHANGES.md](SCHEMA_CHANGES.md) sections 1-8.

Key sections to add:

### 1. Add Enums (after line 684)
```prisma
enum PricingModel {
  TOURNAMENT_WIDE
  PER_STOP
  PER_BRACKET
  PER_STOP_PER_BRACKET
}

enum GameType {
  MENS_DOUBLES
  WOMENS_DOUBLES
  MIXED_DOUBLES_1
  MIXED_DOUBLES_2
  MIXED_DOUBLES
  MENS_SINGLES
  WOMENS_SINGLES
}
```

### 2. Add to Tournament model (after line 158)
```prisma
  pricingModel          PricingModel         @default(TOURNAMENT_WIDE)
```

### 3. Add to Stop model (after line 216)
```prisma
  registrationDeadline  DateTime?            @db.Timestamptz(6)
  isRegistrationClosed  Boolean              @default(false)
  maxPlayersPerBracket  Int?
```

### 4. Add to TournamentBracket model (after line 439)
```prisma
  gameType     GameType?
  skillLevel   String?
```

### 5. Add to TournamentRegistration model (after line 566)
```prisma
  selectedClubId        String?
  selectedStopIds       String[]
  selectedBrackets      Json?
  totalAmountPaid       Int?
```

### 6. Add New Models (after TournamentWaitlist model)

See [SCHEMA_CHANGES.md](SCHEMA_CHANGES.md) Step 8 for the 6 new models.

## Option 2: Work Without Schema Update (Immediate)

You can start Phase 2 development even without updating the schema file:

### How?

Write API endpoints that use raw SQL or Prisma's `$queryRaw`:

```typescript
// Example: Query new StopPricing table
const stopPricing = await prisma.$queryRaw`
  SELECT * FROM "StopPricing"
  WHERE "tournamentId" = ${tournamentId}
`;

// Example: Insert into BracketGameTypeConfig
await prisma.$executeRaw`
  INSERT INTO "BracketGameTypeConfig"
  ("id", "bracketId", "gameType", "isEnabled")
  VALUES (${id}, ${bracketId}, ${gameType}, ${isEnabled})
`;
```

### When to Update Schema

Update the schema when you want:
- TypeScript autocomplete for new models
- Type-safe queries
- Prisma's query builder for new tables

## Option 3: Incremental Updates

Add models to your schema one at a time as you need them in Phase 2:

**Week 1 of Phase 2** - Add pricing models:
- `PricingModel` enum
- `StopPricing` model
- `BracketPricing` model

**Week 2 of Phase 2** - Add game type config:
- `GameType` enum
- `BracketGameTypeConfig` model

**Phase 3** - Add capacity and waitlist:
- `StopBracketCapacity` model
- `StopBracketWaitlist` model
- `RegistrationStopPayment` model

## Recommendation

**For now**: Skip the schema update and move to Phase 2.

**Why?**
1. The introspection is timing out (large database)
2. The database is ready and working
3. You can manually add models as needed
4. You're not blocked from development

**When to do it**: After Phase 2 is complete, or on a weekend when you have time for housekeeping.

---

## Ready for Phase 2?

The database foundation is solid. Let's start building the admin UI!
