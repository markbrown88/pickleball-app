-- Complete fix for ALL foreign key constraints
-- This addresses every single constraint that could be causing UUID issues
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL foreign key constraints
ALTER TABLE "Player" DROP CONSTRAINT IF EXISTS "Player_clubId_fkey";
ALTER TABLE "Stop" DROP CONSTRAINT IF EXISTS "Stop_clubId_fkey";
ALTER TABLE "Stop" DROP CONSTRAINT IF EXISTS "Stop_eventManagerId_fkey";
ALTER TABLE "Stop" DROP CONSTRAINT IF EXISTS "Stop_tournamentId_fkey";
ALTER TABLE "StopTeam" DROP CONSTRAINT IF EXISTS "StopTeam_stopId_fkey";
ALTER TABLE "StopTeam" DROP CONSTRAINT IF EXISTS "StopTeam_teamId_fkey";
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT IF EXISTS "StopTeamPlayer_playerId_fkey";
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT IF EXISTS "StopTeamPlayer_stopId_fkey";
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT IF EXISTS "StopTeamPlayer_teamId_fkey";
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_bracketId_fkey";
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_captainId_fkey";
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_clubId_fkey";
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_tournamentId_fkey";
ALTER TABLE "TeamPlayer" DROP CONSTRAINT IF EXISTS "TeamPlayer_playerId_fkey";
ALTER TABLE "TeamPlayer" DROP CONSTRAINT IF EXISTS "TeamPlayer_teamId_fkey";
ALTER TABLE "TeamPlayer" DROP CONSTRAINT IF EXISTS "TeamPlayer_tournamentId_fkey";

-- Step 2: Ensure ALL ID columns are TEXT type
ALTER TABLE "Player" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Club" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Tournament" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Stop" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Round" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Game" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Match" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "TournamentBracket" ALTER COLUMN "id" TYPE TEXT;

-- Step 3: Ensure ALL foreign key columns are TEXT type
ALTER TABLE "Player" ALTER COLUMN "clubId" TYPE TEXT;
ALTER TABLE "Stop" ALTER COLUMN "clubId" TYPE TEXT;
ALTER TABLE "Stop" ALTER COLUMN "eventManagerId" TYPE TEXT;
ALTER TABLE "Stop" ALTER COLUMN "tournamentId" TYPE TEXT;
ALTER TABLE "StopTeam" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeam" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "bracketId" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "captainId" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "clubId" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "tournamentId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "tournamentId" TYPE TEXT;

-- Step 4: Recreate ALL foreign key constraints
ALTER TABLE "Player" 
ADD CONSTRAINT "Player_clubId_fkey" 
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT;

ALTER TABLE "Stop" 
ADD CONSTRAINT "Stop_clubId_fkey" 
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL;

ALTER TABLE "Stop" 
ADD CONSTRAINT "Stop_eventManagerId_fkey" 
FOREIGN KEY ("eventManagerId") REFERENCES "Player"("id") ON DELETE SET NULL;

ALTER TABLE "Stop" 
ADD CONSTRAINT "Stop_tournamentId_fkey" 
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeam" 
ADD CONSTRAINT "StopTeam_stopId_fkey" 
FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeam" 
ADD CONSTRAINT "StopTeam_teamId_fkey" 
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_stopId_fkey" 
FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_teamId_fkey" 
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_playerId_fkey" 
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE;

ALTER TABLE "Team" 
ADD CONSTRAINT "Team_bracketId_fkey" 
FOREIGN KEY ("bracketId") REFERENCES "TournamentBracket"("id") ON DELETE SET NULL;

ALTER TABLE "Team" 
ADD CONSTRAINT "Team_captainId_fkey" 
FOREIGN KEY ("captainId") REFERENCES "Player"("id") ON DELETE SET NULL;

ALTER TABLE "Team" 
ADD CONSTRAINT "Team_clubId_fkey" 
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL;

ALTER TABLE "Team" 
ADD CONSTRAINT "Team_tournamentId_fkey" 
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE;

ALTER TABLE "TeamPlayer" 
ADD CONSTRAINT "TeamPlayer_teamId_fkey" 
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

ALTER TABLE "TeamPlayer" 
ADD CONSTRAINT "TeamPlayer_playerId_fkey" 
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE;

ALTER TABLE "TeamPlayer" 
ADD CONSTRAINT "TeamPlayer_tournamentId_fkey" 
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE;

-- Step 5: Verify the fix
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name IN ('id', 'stopId', 'teamId', 'playerId', 'tournamentId', 'clubId', 'bracketId', 'eventManagerId', 'captainId')
ORDER BY table_name, column_name;
