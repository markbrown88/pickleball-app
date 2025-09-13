-- Complete UUID to TEXT fix - Version 2
-- This addresses all possible UUID constraint issues
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL foreign key constraints that might be causing issues
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all foreign key constraints on StopTeamPlayer
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'StopTeamPlayer' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Step 2: Ensure all ID columns are TEXT type
ALTER TABLE "Player" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Club" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Tournament" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Stop" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Round" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Game" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Match" ALTER COLUMN "id" TYPE TEXT;

-- Step 3: Ensure all foreign key columns in StopTeamPlayer are TEXT
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;

-- Step 4: Ensure all foreign key columns in other tables are TEXT
ALTER TABLE "StopTeam" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeam" ALTER COLUMN "teamId" TYPE TEXT;

ALTER TABLE "TeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "tournamentId" TYPE TEXT;

-- Step 5: Recreate foreign key constraints
ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_stopId_fkey" 
FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_teamId_fkey" 
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_playerId_fkey" 
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE;

-- Step 6: Recreate other foreign key constraints
ALTER TABLE "StopTeam" 
ADD CONSTRAINT "StopTeam_stopId_fkey" 
FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeam" 
ADD CONSTRAINT "StopTeam_teamId_fkey" 
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

-- Step 7: Verify the fix
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'StopTeamPlayer'
ORDER BY column_name;
