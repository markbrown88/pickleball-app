-- Migration script to transform from Round->Game->Match to Round->Match->Game
-- This will restructure the data to the correct hierarchy

BEGIN;

-- Step 1: Create new Match table with correct structure
CREATE TABLE "Match_new" (
    "id" TEXT PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE,
    FOREIGN KEY ("teamAId") REFERENCES "Team"("id"),
    FOREIGN KEY ("teamBId") REFERENCES "Team"("id")
);

-- Step 2: Create GameSlot enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GameSlot') THEN
        CREATE TYPE "GameSlot" AS ENUM ('MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER');
    END IF;
END $$;

-- Step 3: Create new Game table with correct structure  
CREATE TABLE "Game_new" (
    "id" TEXT PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "slot" "GameSlot",
    "teamAScore" INTEGER,
    "teamBScore" INTEGER,
    "teamALineup" JSONB,
    "teamBLineup" JSONB,
    "lineupConfirmed" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY ("matchId") REFERENCES "Match_new"("id") ON DELETE CASCADE,
    UNIQUE("matchId", "slot")
);

-- Step 4: Migrate data from Game (team matchups) to Match_new
INSERT INTO "Match_new" (
    "id",
    "roundId", 
    "teamAId",
    "teamBId",
    "isBye",
    "createdAt",
    "updatedAt"
)
SELECT 
    "id",
    "roundId",
    "teamAId", 
    "teamBId",
    "isBye",
    "createdAt",
    "updatedAt"
FROM "Game"
WHERE "teamAId" IS NOT NULL OR "teamBId" IS NOT NULL;

-- Step 5: Migrate data from Match (individual slots) to Game_new
INSERT INTO "Game_new" (
    "id",
    "matchId",
    "slot",
    "teamAScore", 
    "teamBScore",
    "teamALineup",
    "teamBLineup", 
    "lineupConfirmed",
    "createdAt",
    "updatedAt"
)
SELECT 
    "id",
    "gameId" as "matchId", -- gameId in old Match table points to team matchup
    "slot"::text::"GameSlot", -- Cast from matchslot to GameSlot
    "teamAScore",
    "teamBScore", 
    "teamALineup",
    "teamBLineup",
    "lineupConfirmed",
    "createdAt",
    "updatedAt"
FROM "Match"
WHERE "gameId" IS NOT NULL;

-- Step 6: Drop old tables
DROP TABLE "Match";
DROP TABLE "Game";

-- Step 7: Rename new tables to final names
ALTER TABLE "Match_new" RENAME TO "Match";
ALTER TABLE "Game_new" RENAME TO "Game";

-- Step 8: Create indexes
CREATE INDEX "Match_roundId_idx" ON "Match"("roundId");
CREATE INDEX "Match_teamAId_idx" ON "Match"("teamAId");
CREATE INDEX "Match_teamBId_idx" ON "Match"("teamBId");
CREATE INDEX "Game_matchId_idx" ON "Game"("matchId");

COMMIT;
