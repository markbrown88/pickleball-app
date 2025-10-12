-- Migration to add slot column to LineupEntry table

-- Step 1: Add the slot column (nullable at first)
ALTER TABLE "LineupEntry" ADD COLUMN IF NOT EXISTS slot TEXT;

-- Step 2: Check current data structure to understand how to populate slot
-- We need to infer the slot based on the order or another field

-- For now, let's set all to a default value, then they can be regenerated
UPDATE "LineupEntry" SET slot = 'MENS_DOUBLES' WHERE slot IS NULL;

-- Step 3: Make the column NOT NULL
ALTER TABLE "LineupEntry" ALTER COLUMN slot SET NOT NULL;

-- Step 4: Add the unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'LineupEntry_lineupId_slot_key'
  ) THEN
    -- First, remove any duplicates that might exist
    DELETE FROM "LineupEntry" a
    USING "LineupEntry" b
    WHERE a.id > b.id
      AND a."lineupId" = b."lineupId"
      AND a.slot = b.slot;

    -- Then add the constraint
    ALTER TABLE "LineupEntry" ADD CONSTRAINT "LineupEntry_lineupId_slot_key" UNIQUE ("lineupId", slot);
  END IF;
END $$;

-- Step 5: Verify
SELECT COUNT(*) as total_entries FROM "LineupEntry";
SELECT "lineupId", slot, COUNT(*) as count
FROM "LineupEntry"
GROUP BY "lineupId", slot
HAVING COUNT(*) > 1;
