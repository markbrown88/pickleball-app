-- Fix UUID schema issue by changing ID columns from UUID to TEXT
-- This allows both CUID and UUID formats to work

-- Update Player table
ALTER TABLE "Player" ALTER COLUMN "id" TYPE TEXT;

-- Update Club table  
ALTER TABLE "Club" ALTER COLUMN "id" TYPE TEXT;

-- Update Tournament table
ALTER TABLE "Tournament" ALTER COLUMN "id" TYPE TEXT;

-- Update Team table
ALTER TABLE "Team" ALTER COLUMN "id" TYPE TEXT;

-- Update Stop table
ALTER TABLE "Stop" ALTER COLUMN "id" TYPE TEXT;

-- Update Round table
ALTER TABLE "Round" ALTER COLUMN "id" TYPE TEXT;

-- Update Game table
ALTER TABLE "Game" ALTER COLUMN "id" TYPE TEXT;

-- Update Match table
ALTER TABLE "Match" ALTER COLUMN "id" TYPE TEXT;

-- Update StopTeam table
ALTER TABLE "StopTeam" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeam" ALTER COLUMN "teamId" TYPE TEXT;

-- Update StopTeamPlayer table
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "stopId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "StopTeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;

-- Update TeamPlayer table
ALTER TABLE "TeamPlayer" ALTER COLUMN "teamId" TYPE TEXT;
ALTER TABLE "TeamPlayer" ALTER COLUMN "playerId" TYPE TEXT;

