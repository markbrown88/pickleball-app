-- Verify the database structure after migration
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('Round', 'Match', 'Game')
    AND column_name IN ('roundId', 'matchId', 'id')
ORDER BY table_name, column_name;
