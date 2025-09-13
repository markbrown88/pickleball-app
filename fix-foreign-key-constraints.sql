-- Fix foreign key constraints that are still enforcing UUID type
-- We need to drop and recreate the constraints after changing column types

-- Drop foreign key constraints on StopTeamPlayer
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT "StopTeamPlayer_stopId_fkey";
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT "StopTeamPlayer_teamId_fkey";
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT "StopTeamPlayer_playerId_fkey";

-- Drop the primary key constraint
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT "StopTeamPlayer_pkey";

-- Recreate the primary key constraint
ALTER TABLE "StopTeamPlayer" ADD CONSTRAINT "StopTeamPlayer_pkey" PRIMARY KEY ("stopId", "teamId", "playerId");

-- Recreate foreign key constraints
ALTER TABLE "StopTeamPlayer" ADD CONSTRAINT "StopTeamPlayer_stopId_fkey" 
    FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" ADD CONSTRAINT "StopTeamPlayer_teamId_fkey" 
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" ADD CONSTRAINT "StopTeamPlayer_playerId_fkey" 
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE;

-- Check if there are similar issues with other tables
-- Let's also check and fix StopTeam table constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'StopTeam';

