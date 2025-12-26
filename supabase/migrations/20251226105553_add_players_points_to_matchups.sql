-- Add players_points column to store individual player fantasy points per matchup
ALTER TABLE matchups
ADD COLUMN players_points JSONB;

COMMENT ON COLUMN matchups.players_points IS 'Map of player_id to fantasy points scored for this matchup';
