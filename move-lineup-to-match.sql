-- Move lineup fields from Game table to Match table
-- This aligns with the logical data model: Round → Match → Game

-- Add lineup columns to Match table
ALTER TABLE "Match" ADD COLUMN "teamALineup" JSONB;
ALTER TABLE "Match" ADD COLUMN "teamBLineup" JSONB;
ALTER TABLE "Match" ADD COLUMN "lineupConfirmed" BOOLEAN DEFAULT false;

-- Remove lineup columns from Game table
ALTER TABLE "Game" DROP COLUMN "teamALineup";
ALTER TABLE "Game" DROP COLUMN "teamBLineup";
ALTER TABLE "Game" DROP COLUMN "lineupConfirmed";
