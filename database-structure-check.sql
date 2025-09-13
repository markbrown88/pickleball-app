-- Comprehensive database structure check for Round, Match, and Game tables
-- This will help us understand the current database structure vs our Prisma schema

-- 1. Check if the tables exist and their basic structure
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('Round', 'Match', 'Game')
ORDER BY table_name;

-- 2. Check Round table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'Round' 
ORDER BY ordinal_position;

-- 3. Check Match table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'Match' 
ORDER BY ordinal_position;

-- 4. Check Game table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'Game' 
ORDER BY ordinal_position;

-- 5. Check foreign key constraints
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
    AND tc.table_name IN ('Round', 'Match', 'Game')
ORDER BY tc.table_name, kcu.column_name;

-- 6. Check indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('Round', 'Match', 'Game')
ORDER BY tablename, indexname;

-- 7. Sample data from each table (first 3 rows)
SELECT 'Round' as table_name, * FROM "Round" LIMIT 3;
SELECT 'Match' as table_name, * FROM "Match" LIMIT 3;  
SELECT 'Game' as table_name, * FROM "Game" LIMIT 3;

-- 8. Check if roundId exists in Match table (this is the key issue)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Match' AND column_name = 'roundId';

-- 9. Check if matchId exists in Game table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Game' AND column_name = 'matchId';

-- 10. Check if gameId exists in Game table (old structure)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Game' AND column_name = 'gameId';

-- 11. Check if gameId exists in Match table (old structure)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Match' AND column_name = 'gameId';

-- 12. Count records in each table
SELECT 'Round' as table_name, COUNT(*) as record_count FROM "Round"
UNION ALL
SELECT 'Match' as table_name, COUNT(*) as record_count FROM "Match"
UNION ALL
SELECT 'Game' as table_name, COUNT(*) as record_count FROM "Game";
