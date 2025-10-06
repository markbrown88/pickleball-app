-- Add status column to Game table
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started';

-- Update any existing null values to 'not_started'
UPDATE "Game" SET status = 'not_started' WHERE status IS NULL;
