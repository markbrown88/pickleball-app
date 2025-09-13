-- Diagnose the actual database schema to see what's causing the UUID error
-- Run this in Supabase SQL Editor

-- Check the data types of all ID columns
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE column_name IN ('id', 'stopId', 'teamId', 'playerId', 'tournamentId', 'roundId', 'gameId', 'matchId', 'clubId')
ORDER BY table_name, column_name;

-- Check foreign key constraints
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
    AND (tc.table_name = 'StopTeamPlayer' OR ccu.table_name = 'StopTeamPlayer')
ORDER BY tc.table_name, kcu.column_name;

-- Check if there are any UUID constraints or indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'StopTeamPlayer';

-- Check the actual data in StopTeamPlayer to see what format the IDs are
SELECT 
    "stopId",
    "teamId", 
    "playerId",
    pg_typeof("stopId") as stopId_type,
    pg_typeof("teamId") as teamId_type,
    pg_typeof("playerId") as playerId_type
FROM "StopTeamPlayer" 
LIMIT 5;
