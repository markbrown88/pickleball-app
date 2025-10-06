-- Add fullName column to Club table
-- This query adds the new required fullName field to existing clubs

-- First, add the column as nullable
ALTER TABLE "Club" ADD COLUMN "fullName" TEXT;

-- Update existing clubs to set fullName = name (so we don't lose data)
UPDATE "Club" SET "fullName" = "name" WHERE "fullName" IS NULL;

-- Now make the column NOT NULL (required)
ALTER TABLE "Club" ALTER COLUMN "fullName" SET NOT NULL;

-- Optional: Add a default value for any future inserts
-- ALTER TABLE "Club" ALTER COLUMN "fullName" SET DEFAULT '';

-- Verify the changes
SELECT id, "fullName", name, city, region FROM "Club" LIMIT 5;



