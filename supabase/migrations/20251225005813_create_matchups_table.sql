-- Create matchups table to store weekly matchup results
-- Each row represents one team's side of a matchup
-- Two teams with the same matchup_id played against each other
CREATE TABLE matchups (
  id BIGSERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  matchup_id INTEGER NOT NULL,
  roster_id INTEGER NOT NULL,
  starters TEXT[] NOT NULL,
  players TEXT[] NOT NULL,
  points DECIMAL(10, 2),
  custom_points DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, week, roster_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_matchups_season_week ON matchups(season_id, week);
CREATE INDEX idx_matchups_matchup_pair ON matchups(season_id, week, matchup_id);
CREATE INDEX idx_matchups_roster ON matchups(roster_id);
CREATE INDEX idx_matchups_starters ON matchups USING GIN(starters);
CREATE INDEX idx_matchups_players ON matchups USING GIN(players);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_matchups_updated_at
  BEFORE UPDATE ON matchups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON matchups
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON matchups
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON matchups
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON matchups
  FOR DELETE
  USING (auth.role() = 'service_role');
