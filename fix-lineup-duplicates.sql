-- Fix duplicate LineupEntry records before adding unique constraint
-- This script removes duplicate entries, keeping only the most recent one

-- Step 1: Delete duplicate entries (keep the one with the latest createdAt)
DELETE FROM "LineupEntry" a
USING "LineupEntry" b
WHERE a.id < b.id
  AND a."lineupId" = b."lineupId"
  AND a.slot = b.slot;

-- Step 2: Drop the existing constraint if it exists
ALTER TABLE "LineupEntry" DROP CONSTRAINT IF EXISTS "LineupEntry_lineupId_slot_key";

-- Step 3: Add the unique constraint
ALTER TABLE "LineupEntry" ADD CONSTRAINT "LineupEntry_lineupId_slot_key" UNIQUE ("lineupId", slot);

-- Verify the fix
SELECT "lineupId", slot, COUNT(*) as count
FROM "LineupEntry"
GROUP BY "lineupId", slot
HAVING COUNT(*) > 1;
-- This should return 0 rows if successful
