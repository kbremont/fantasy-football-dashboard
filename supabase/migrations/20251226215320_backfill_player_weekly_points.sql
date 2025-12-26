-- Backfill player_weekly_points from existing matchups.players_points JSONB data
-- This extracts the denormalized JSONB data into the new normalized table
INSERT INTO player_weekly_points (player_id, season_id, week, roster_id, points, is_starter)
SELECT
  kv.key AS player_id,
  m.season_id,
  m.week,
  m.roster_id,
  (kv.value)::decimal(10,2) AS points,
  kv.key = ANY(m.starters) AS is_starter
FROM matchups m
CROSS JOIN LATERAL jsonb_each(m.players_points) AS kv(key, value)
WHERE m.players_points IS NOT NULL
ON CONFLICT (player_id, season_id, week, roster_id) DO UPDATE SET
  points = EXCLUDED.points,
  is_starter = EXCLUDED.is_starter;
