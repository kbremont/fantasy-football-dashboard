-- Create player_weekly_points table to track individual player fantasy points per week
-- This normalizes the players_points JSONB data from matchups into a dedicated table
CREATE TABLE player_weekly_points (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  roster_id INTEGER NOT NULL,
  points DECIMAL(10, 2),
  is_starter BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, season_id, week, roster_id)
);

-- Indexes for common query patterns
-- Player's season history (e.g., all weeks for a player in a season)
CREATE INDEX idx_player_weekly_points_player_season ON player_weekly_points(player_id, season_id);

-- All players for a specific week (e.g., weekly leaderboards)
CREATE INDEX idx_player_weekly_points_season_week ON player_weekly_points(season_id, week);

-- Player across all seasons (e.g., career stats)
CREATE INDEX idx_player_weekly_points_player ON player_weekly_points(player_id);

-- Roster's players for a specific week (e.g., team's player breakdown)
CREATE INDEX idx_player_weekly_points_roster_season_week ON player_weekly_points(roster_id, season_id, week);

-- Enable Row Level Security
ALTER TABLE player_weekly_points ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON player_weekly_points
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON player_weekly_points
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON player_weekly_points
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON player_weekly_points
  FOR DELETE
  USING (auth.role() = 'service_role');
