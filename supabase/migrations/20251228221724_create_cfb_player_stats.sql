-- Create table for college football player season statistics from CFBD API

CREATE TABLE cfb_player_season_stats (
  id BIGSERIAL PRIMARY KEY,
  cfbd_player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  season INTEGER NOT NULL,
  team TEXT,
  conference TEXT,
  position TEXT,
  category TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  stat_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cfbd_player_id, season, category, stat_type)
);

-- Indexes for common query patterns
CREATE INDEX idx_cfb_player_stats_season ON cfb_player_season_stats(season);
CREATE INDEX idx_cfb_player_stats_team ON cfb_player_season_stats(team);
CREATE INDEX idx_cfb_player_stats_position ON cfb_player_season_stats(position);
CREATE INDEX idx_cfb_player_stats_category ON cfb_player_season_stats(category);
CREATE INDEX idx_cfb_player_stats_player_id ON cfb_player_season_stats(cfbd_player_id);

-- GIN index for fuzzy player name search (requires pg_trgm extension)
CREATE INDEX idx_cfb_player_stats_player_name_trgm ON cfb_player_season_stats
  USING GIN (player_name gin_trgm_ops);

-- Enable RLS
ALTER TABLE cfb_player_season_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for dashboard)
CREATE POLICY "Allow public read access on cfb_player_season_stats"
  ON cfb_player_season_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role full access (for edge function sync)
CREATE POLICY "Allow service role full access on cfb_player_season_stats"
  ON cfb_player_season_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_cfb_player_season_stats_updated_at
  BEFORE UPDATE ON cfb_player_season_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
