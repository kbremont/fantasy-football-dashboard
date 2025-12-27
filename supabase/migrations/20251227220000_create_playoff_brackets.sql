-- Create playoff_brackets table to store bracket structure
-- Stores both winners (championship) and losers (consolation) brackets
-- Points data comes from the matchups table via playoff_week join
CREATE TABLE playoff_brackets (
  id BIGSERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  bracket_type TEXT NOT NULL CHECK (bracket_type IN ('winners', 'losers')),
  round INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  roster_id_1 INTEGER,           -- Team 1 (null if TBD from previous match)
  roster_id_2 INTEGER,           -- Team 2 (null if TBD from previous match)
  winner_roster_id INTEGER,      -- Winner (null if not played)
  loser_roster_id INTEGER,       -- Loser (null if not played)
  t1_from JSONB,                 -- Where team 1 comes from: {"w": match_id} or {"l": match_id}
  t2_from JSONB,                 -- Where team 2 comes from
  playoff_week INTEGER,          -- NFL week this matchup occurs (15, 16, 17)
  final_position INTEGER,        -- Final standing (1=champ, 2=runner-up, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, bracket_type, match_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_playoff_brackets_season ON playoff_brackets(season_id);
CREATE INDEX idx_playoff_brackets_round ON playoff_brackets(season_id, round);
CREATE INDEX idx_playoff_brackets_winner ON playoff_brackets(winner_roster_id);
CREATE INDEX idx_playoff_brackets_type ON playoff_brackets(season_id, bracket_type);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_playoff_brackets_updated_at
  BEFORE UPDATE ON playoff_brackets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE playoff_brackets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON playoff_brackets
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON playoff_brackets
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON playoff_brackets
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON playoff_brackets
  FOR DELETE
  USING (auth.role() = 'service_role');
