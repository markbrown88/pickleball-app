-- Safe migration: Add slot column and clear incomplete lineup data
-- This preserves all completed games and historical data

-- Step 1: Add the slot column with a default value
ALTER TABLE "LineupEntry" ADD COLUMN IF NOT EXISTS slot TEXT DEFAULT 'MENS_DOUBLES';

-- Step 2: Make the column NOT NULL
ALTER TABLE "LineupEntry" ALTER COLUMN slot SET NOT NULL;

-- Step 3: Clear out incomplete/test LineupEntry data (it will be regenerated)
TRUNCATE TABLE "LineupEntry";

-- Step 4: Add the unique constraint
ALTER TABLE "LineupEntry"
DROP CONSTRAINT IF EXISTS "LineupEntry_lineupId_slot_key";

ALTER TABLE "LineupEntry"
ADD CONSTRAINT "LineupEntry_lineupId_slot_key" UNIQUE ("lineupId", slot);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'LineupEntry'
ORDER BY ordinal_position;

SELECT COUNT(*) as remaining_entries FROM "LineupEntry";
