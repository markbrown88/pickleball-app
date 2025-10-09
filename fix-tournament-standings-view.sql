-- Fix the tournament standings materialized view
-- The issue is in the complex CASE statements and JOIN logic

-- Drop the existing view
DROP MATERIALIZED VIEW IF EXISTS tournament_standings;

-- Create the corrected materialized view
CREATE MATERIALIZED VIEW tournament_standings AS
WITH match_results AS (
  -- Calculate match results for each team
  SELECT 
    m.id as match_id,
    t.id as tournament_id,
    m."forfeitTeam",
    ta.id as team_a_id,
    ta.name as team_a_name,
    ta."clubId" as team_a_club_id,
    tb.id as team_b_id,
    tb.name as team_b_name,
    tb."clubId" as team_b_club_id,
    -- For forfeited matches - simplified logic
    CASE 
      WHEN m."forfeitTeam" = 'A' THEN 0  -- Team A forfeited, gets 0 points
      WHEN m."forfeitTeam" = 'B' THEN 0  -- Team B forfeited, gets 0 points
      ELSE 0
    END as team_a_forfeit_points,
    CASE 
      WHEN m."forfeitTeam" = 'A' THEN 0  -- Team A forfeited, gets 0 points
      WHEN m."forfeitTeam" = 'B' THEN 0  -- Team B forfeited, gets 0 points
      ELSE 0
    END as team_b_forfeit_points,
    -- For normal matches, calculate from games - simplified logic
    CASE 
      WHEN m."forfeitTeam" IS NULL THEN (
        WITH game_scores AS (
          SELECT 
            CASE WHEN g."teamAScore" > g."teamBScore" THEN 1 ELSE 0 END as team_a_wins,
            CASE WHEN g."teamBScore" > g."teamAScore" THEN 1 ELSE 0 END as team_b_wins
          FROM "Game" g 
          WHERE g."matchId" = m.id 
            AND g."teamAScore" IS NOT NULL 
            AND g."teamBScore" IS NOT NULL
        )
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            WHEN SUM(team_a_wins) > SUM(team_b_wins) THEN 3
            WHEN SUM(team_b_wins) > SUM(team_a_wins) THEN 1
            ELSE 0
          END
        FROM game_scores
      )
      ELSE 0
    END as team_a_normal_points,
    CASE 
      WHEN m."forfeitTeam" IS NULL THEN (
        WITH game_scores AS (
          SELECT 
            CASE WHEN g."teamAScore" > g."teamBScore" THEN 1 ELSE 0 END as team_a_wins,
            CASE WHEN g."teamBScore" > g."teamAScore" THEN 1 ELSE 0 END as team_b_wins
          FROM "Game" g 
          WHERE g."matchId" = m.id 
            AND g."teamAScore" IS NOT NULL 
            AND g."teamBScore" IS NOT NULL
        )
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            WHEN SUM(team_b_wins) > SUM(team_a_wins) THEN 3
            WHEN SUM(team_a_wins) > SUM(team_b_wins) THEN 1
            ELSE 0
          END
        FROM game_scores
      )
      ELSE 0
    END as team_b_normal_points
  FROM "Match" m
  LEFT JOIN "Team" ta ON m."teamAId" = ta.id
  LEFT JOIN "Team" tb ON m."teamBId" = tb.id
  LEFT JOIN "Round" r ON m."roundId" = r.id
  LEFT JOIN "Stop" s ON r."stopId" = s.id
  LEFT JOIN "Tournament" t ON s."tournamentId" = t.id
  WHERE t.id IS NOT NULL
    AND ta.id IS NOT NULL 
    AND tb.id IS NOT NULL
),
team_points AS (
  -- Aggregate points for each team
  SELECT 
    team_id,
    team_name,
    club_id,
    tournament_id,
    COUNT(*) as matches_played,
    SUM(CASE WHEN points > 0 THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN points = 0 THEN 1 ELSE 0 END) as losses,
    SUM(points) as points
  FROM (
    -- Team A results
    SELECT 
      team_a_id as team_id,
      team_a_name as team_name,
      team_a_club_id as club_id,
      tournament_id,
      (team_a_forfeit_points + team_a_normal_points) as points
    FROM match_results
    WHERE team_a_id IS NOT NULL
    
    UNION ALL
    
    -- Team B results  
    SELECT 
      team_b_id as team_id,
      team_b_name as team_name,
      team_b_club_id as club_id,
      tournament_id,
      (team_b_forfeit_points + team_b_normal_points) as points
    FROM match_results
    WHERE team_b_id IS NOT NULL
  ) all_results
  GROUP BY team_id, team_name, club_id, tournament_id
)
SELECT 
  team_id,
  team_name,
  club_id as "clubId",
  tournament_id as "tournamentId",
  matches_played,
  wins,
  losses,
  points
FROM team_points
ORDER BY points DESC, team_name ASC;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tournament_standings_tournament_id 
ON tournament_standings ("tournamentId");

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_tournament_standings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW tournament_standings;
END;
$$ LANGUAGE plpgsql;
