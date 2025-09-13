-- Check the actual database structure to understand current schema
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('Round', 'Match', 'Game')
ORDER BY table_name, ordinal_position;
