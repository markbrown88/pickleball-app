-- Fix foreign key constraints that might still be expecting UUID format
-- Run this in Supabase SQL Editor

-- First, let's see what foreign key constraints exist
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'StopTeamPlayer';

-- Drop all foreign key constraints on StopTeamPlayer
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT IF EXISTS "StopTeamPlayer_stopId_fkey";
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT IF EXISTS "StopTeamPlayer_teamId_fkey";
ALTER TABLE "StopTeamPlayer" DROP CONSTRAINT IF EXISTS "StopTeamPlayer_playerId_fkey";

-- Recreate the foreign key constraints with TEXT columns
ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_stopId_fkey" 
FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_teamId_fkey" 
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

ALTER TABLE "StopTeamPlayer" 
ADD CONSTRAINT "StopTeamPlayer_playerId_fkey" 
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE;
