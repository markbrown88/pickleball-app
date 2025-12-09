# Database Migration Instructions (Phase 1)

Since direct database access is restricted, please run the following SQL script in your **Supabase SQL Editor**. This will apply the necessary schema changes for the Club Director features.

```sql
-- PHASE 1: CLUB DIRECTOR SCHEMA MIGRATION

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "ClubStatus" AS ENUM ('ACTIVE', 'SUBSCRIBED', 'PAST_DUE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClubRole" AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update Club Table
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "status" "ClubStatus" DEFAULT 'ACTIVE';
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus";

-- 3. Create ClubDirector Table
CREATE TABLE IF NOT EXISTS "ClubDirector" (
    "clubId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "ClubRole" NOT NULL DEFAULT 'ADMIN',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubDirector_pkey" PRIMARY KEY ("clubId","playerId")
);

-- 4. Create SystemSettings Table
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'settings',
    "monthlySubscriptionPrice" INTEGER NOT NULL DEFAULT 6999,
    "annualSubscriptionPrice" INTEGER NOT NULL DEFAULT 79999,
    "isSubscriptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- 5. Add Foreign Keys for ClubDirector
DO $$ BEGIN
    ALTER TABLE "ClubDirector" ADD CONSTRAINT "ClubDirector_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ClubDirector" ADD CONSTRAINT "ClubDirector_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. Add Indexes
CREATE INDEX IF NOT EXISTS "ClubDirector_playerId_idx" ON "ClubDirector"("playerId");
CREATE INDEX IF NOT EXISTS "ClubDirector_clubId_idx" ON "ClubDirector"("clubId");
```

## Next Steps
1. Run the SQL above in Supabase.
2. The strictly "Legacy" table rename (`ClubRegistration` to `LegacyClubRegistration`) is handled in the application code via mapping.

## Phase 2: Tournament Ownership

Please run this after the first script to enable linking tournaments to clubs.

```sql
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "ownerClubId" TEXT;

DO $$ BEGIN
    ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_ownerClubId_fkey" FOREIGN KEY ("ownerClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

## Phase 3: Captain Portal Tables

The **500 Internal Server Error** you are seeing on the live Captain Portal is because these tables are missing from your database. Run this script immediately to fix it.

```sql
-- 1. Create CaptainPortalAttempt
CREATE TABLE IF NOT EXISTS "CaptainPortalAttempt" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptainPortalAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaptainPortalAttempt_token_createdAt_idx" ON "CaptainPortalAttempt"("token", "createdAt");
CREATE INDEX IF NOT EXISTS "CaptainPortalAttempt_ipAddress_createdAt_idx" ON "CaptainPortalAttempt"("ipAddress", "createdAt");

-- 2. Create TournamentClub
CREATE TABLE IF NOT EXISTS "TournamentClub" (
    "tournamentId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "captainAccessToken" TEXT,

    CONSTRAINT "TournamentClub_pkey" PRIMARY KEY ("tournamentId", "clubId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentClub_captainAccessToken_key" ON "TournamentClub"("captainAccessToken");
CREATE INDEX IF NOT EXISTS "TournamentClub_clubId_idx" ON "TournamentClub"("clubId");

-- 3. Add Foreign Keys for TournamentClub
DO $$ BEGIN
    ALTER TABLE "TournamentClub" ADD CONSTRAINT "TournamentClub_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TournamentClub" ADD CONSTRAINT "TournamentClub_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```
