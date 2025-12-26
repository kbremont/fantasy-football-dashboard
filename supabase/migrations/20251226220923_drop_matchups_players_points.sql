-- Remove players_points JSONB column from matchups table
-- This data is now normalized in the player_weekly_points table
ALTER TABLE matchups DROP COLUMN IF EXISTS players_points;
