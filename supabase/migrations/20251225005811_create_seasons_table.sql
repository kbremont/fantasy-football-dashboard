-- Create seasons table to track league IDs across seasons
-- Sleeper creates a new league_id each year, this table maps them
CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  season_year INTEGER NOT NULL,
  sleeper_league_id TEXT NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  total_weeks INTEGER DEFAULT 18,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_year),
  UNIQUE(sleeper_league_id)
);

-- Indexes
CREATE INDEX idx_seasons_is_current ON seasons(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_seasons_year ON seasons(season_year);

-- Create trigger to automatically update updated_at
-- Reuses the function created in create_nfl_players migration
CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON seasons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON seasons
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON seasons
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON seasons
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON seasons
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Insert current season (2024)
INSERT INTO seasons (season_year, sleeper_league_id, is_current)
VALUES (2024, '1180722152528445440', TRUE);
