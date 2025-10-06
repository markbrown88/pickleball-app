-- Migration: Add Captain Portal Fields
-- Run this SQL in your Supabase SQL Editor

-- Add captainAccessToken to TournamentClub
ALTER TABLE "TournamentClub"
ADD COLUMN IF NOT EXISTS "captainAccessToken" TEXT;

-- Add unique constraint
ALTER TABLE "TournamentClub"
ADD CONSTRAINT "TournamentClub_captainAccessToken_key" UNIQUE ("captainAccessToken");

-- Add lineupDeadline to Stop
ALTER TABLE "Stop"
ADD COLUMN IF NOT EXISTS "lineupDeadline" TIMESTAMPTZ;

-- Add score confirmation fields to Game
ALTER TABLE "Game"
ADD COLUMN IF NOT EXISTS "teamAScoreSubmitted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "teamBScoreSubmitted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "teamASubmittedScore" INTEGER,
ADD COLUMN IF NOT EXISTS "teamBSubmittedScore" INTEGER;

-- Update existing rows to have default values
UPDATE "Game"
SET "teamAScoreSubmitted" = false, "teamBScoreSubmitted" = false
WHERE "teamAScoreSubmitted" IS NULL OR "teamBScoreSubmitted" IS NULL;
