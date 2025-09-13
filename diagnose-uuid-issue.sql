-- Diagnostic query to find remaining UUID columns
SELECT 
    table_name, 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND data_type = 'uuid'
ORDER BY table_name, column_name;

-- Specifically check StopTeamPlayer table structure
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'StopTeamPlayer'
ORDER BY ordinal_position;

-- Check if there are any constraints or indexes that might be causing issues
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'StopTeamPlayer';
