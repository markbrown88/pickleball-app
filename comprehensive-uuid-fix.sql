-- Comprehensive UUID to TEXT migration
-- This covers all possible foreign key columns that might still be UUID type

-- First, let's check what columns are still UUID type
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND data_type = 'uuid'
ORDER BY table_name, column_name;

-- Update all remaining UUID columns to TEXT
-- Primary key columns
ALTER TABLE "Player" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Club" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Tournament" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Stop" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Round" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Game" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "Match" ALTER COLUMN "id" TYPE TEXT;

-- Foreign key columns
ALTER TABLE "Player" ALTER COLUMN "clubId" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "tournamentId" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "clubId" TYPE TEXT;
ALTER TABLE "Team" ALTER COLUMN "bracketId" TYPE TEXT;
ALTER TABLE "Stop" ALTER COLUMN "tournamentId" TYPE TEXT;
ALTER TABLE "Round" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "Game" ALTER COLUMN "roundId" TYPE TEXT;
ALTER TABLE "Game" ALTER COLUMN "teamAId" TYPE TEXT;
ALTER TABLE "Game" ALTER COLUMN "teamBId" TYPE TEXT;
ALTER TABLE "Match" ALTER COLUMN "gameId" TYPE TEXT;

-- Junction table columns
ALTER TABLE "StopTeam" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeam" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "tournamentId" TYPE TEXT;

-- Check if there are any other tables with UUID columns
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND data_type = 'uuid'
ORDER BY table_name, column_name;
