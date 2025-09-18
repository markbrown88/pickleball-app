-- Fix the database trigger to allow players on different teams for different stops
-- Run this in Supabase SQL Editor

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS "tr_stopteamplayer_before_insert_guard" ON "StopTeamPlayer";
DROP FUNCTION IF EXISTS "fn_stopteamplayer_before_insert_guard"();

-- Create a new function that allows multi-stop tournament rosters
CREATE OR REPLACE FUNCTION "fn_stopteamplayer_before_insert_guard"()
RETURNS TRIGGER AS $$
DECLARE
  v_tid TEXT;
  v_conflict_team TEXT;
  v_stop_id TEXT;
BEGIN
  -- Determine tournament via team
  SELECT "tournamentId" INTO v_tid FROM "Team" WHERE "id" = NEW."teamId";
  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'Team % has no tournamentId', NEW."teamId";
  END IF;

  -- Get the stop ID from the new record
  v_stop_id := NEW."stopId";

  -- Guard: deny if player already claimed by another team for the SAME STOP
  -- (but allow them to be on different teams for different stops)
  SELECT stp."teamId" INTO v_conflict_team
  FROM "StopTeamPlayer" stp
  WHERE stp."playerId" = NEW."playerId"
    AND stp."stopId" = v_stop_id
    AND stp."teamId" <> NEW."teamId"
  LIMIT 1;

  IF v_conflict_team IS NOT NULL THEN
    RAISE EXCEPTION 'Player % is already rostered on team % for this stop',
      NEW."playerId", v_conflict_team;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER "tr_stopteamplayer_before_insert_guard"
  BEFORE INSERT ON "StopTeamPlayer"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_stopteamplayer_before_insert_guard"();
