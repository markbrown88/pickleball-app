-- Check what columns actually exist in LineupEntry table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'LineupEntry';

-- Check what columns actually exist in Lineup table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Lineup';

-- Check what columns actually exist in Game table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Game';

-- Count lineups for the Klyng tournament Stop 2
SELECT COUNT(*) as lineup_count
FROM "Lineup" l
JOIN "Round" r ON l."roundId" = r.id
WHERE r."stopId" = 'cmfot1xyc0006rd6akzrbmapv';

-- Get sample lineup data (without joining entries to avoid the slot issue)
SELECT l.id, l."roundId", l."teamId", l."createdAt"
FROM "Lineup" l
JOIN "Round" r ON l."roundId" = r.id
WHERE r."stopId" = 'cmfot1xyc0006rd6akzrbmapv'
LIMIT 5;

-- Check LineupEntry records
SELECT COUNT(*) as entry_count
FROM "LineupEntry" le
JOIN "Lineup" l ON le."lineupId" = l.id
JOIN "Round" r ON l."roundId" = r.id
WHERE r."stopId" = 'cmfot1xyc0006rd6akzrbmapv';

-- Get sample LineupEntry to see what columns have data
SELECT *
FROM "LineupEntry" le
JOIN "Lineup" l ON le."lineupId" = l.id
JOIN "Round" r ON l."roundId" = r.id
WHERE r."stopId" = 'cmfot1xyc0006rd6akzrbmapv'
LIMIT 2;
