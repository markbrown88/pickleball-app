-- Fix the database triggers to use TEXT instead of UUID
-- Run this in Supabase SQL Editor

-- Drop the existing triggers first
DROP TRIGGER IF EXISTS "tr_stopteamplayer_after_insert_sync" ON "StopTeamPlayer";
DROP TRIGGER IF EXISTS "tr_stopteamplayer_after_delete_cleanup" ON "StopTeamPlayer";
DROP TRIGGER IF EXISTS "tr_stopteamplayer_before_insert_guard" ON "StopTeamPlayer";

-- Drop the existing functions
DROP FUNCTION IF EXISTS "fn_stopteamplayer_after_insert_sync"();
DROP FUNCTION IF EXISTS "fn_stopteamplayer_after_delete_cleanup"();
DROP FUNCTION IF EXISTS "fn_stopteamplayer_before_insert_guard"();

-- Recreate the functions with TEXT instead of UUID
CREATE OR REPLACE FUNCTION "fn_stopteamplayer_after_insert_sync"()
RETURNS TRIGGER AS $$
DECLARE
  v_tid TEXT;
BEGIN
  SELECT "tournamentId" INTO v_tid FROM "Team" WHERE "id" = NEW."teamId";

  INSERT INTO "TeamPlayer" ("playerId","teamId","tournamentId")
  VALUES (NEW."playerId", NEW."teamId", v_tid)
  ON CONFLICT ("teamId","playerId")
  DO UPDATE SET "tournamentId" = EXCLUDED."tournamentId";

  RETURN NULL;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "fn_stopteamplayer_after_delete_cleanup"()
RETURNS TRIGGER AS $$
DECLARE
  v_tid TEXT;
  v_remaining integer;
BEGIN
  SELECT "tournamentId" INTO v_tid FROM "Team" WHERE "id" = OLD."teamId";

  -- Are there any stop-roster rows left for this player in this tournament?
  SELECT COUNT(*) INTO v_remaining
  FROM "StopTeamPlayer" stp
  JOIN "Team" t ON t."id" = stp."teamId"
  WHERE stp."playerId" = OLD."playerId"
    AND t."tournamentId" = v_tid;

  IF v_remaining = 0 THEN
    -- Remove any tournament-level claim(s) in that tournament
    DELETE FROM "TeamPlayer" tp
    USING "Team" t
    WHERE tp."playerId" = OLD."playerId"
      AND tp."teamId" = t."id"
      AND t."tournamentId" = v_tid;
  END IF;

  RETURN NULL;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "fn_stopteamplayer_before_insert_guard"()
RETURNS TRIGGER AS $$
DECLARE
  v_tid TEXT;
  v_conflict_team TEXT;
BEGIN
  -- Determine tournament via team
  SELECT "tournamentId" INTO v_tid FROM "Team" WHERE "id" = NEW."teamId";
  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'Team % has no tournamentId', NEW."teamId";
  END IF;

  -- Guard: deny if player already claimed by another team in same tournament
  SELECT tp."teamId" INTO v_conflict_team
  FROM "TeamPlayer" tp
  WHERE tp."playerId" = NEW."playerId"
    AND tp."tournamentId" = v_tid
    AND tp."teamId" <> NEW."teamId"
  LIMIT 1;

  IF v_conflict_team IS NOT NULL THEN
    RAISE EXCEPTION 'Player % is already rostered on team % for this tournament',
      NEW."playerId", v_conflict_team;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER "tr_stopteamplayer_after_insert_sync"
  AFTER INSERT ON "StopTeamPlayer"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_stopteamplayer_after_insert_sync"();

CREATE TRIGGER "tr_stopteamplayer_after_delete_cleanup"
  AFTER DELETE ON "StopTeamPlayer"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_stopteamplayer_after_delete_cleanup"();

CREATE TRIGGER "tr_stopteamplayer_before_insert_guard"
  BEFORE INSERT ON "StopTeamPlayer"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_stopteamplayer_before_insert_guard"();
