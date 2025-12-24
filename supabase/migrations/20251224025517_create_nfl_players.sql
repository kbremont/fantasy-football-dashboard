-- Create enum type for player positions
CREATE TYPE position_enum AS ENUM ('QB', 'RB', 'WR', 'TE');

-- Create nfl_players table
CREATE TABLE nfl_players (
  player_id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  position position_enum NOT NULL,
  team VARCHAR(3) NOT NULL,
  college TEXT,
  age NUMERIC(3, 1),
  weight INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_nfl_players_position ON nfl_players(position);
CREATE INDEX idx_nfl_players_team ON nfl_players(team);
CREATE INDEX idx_nfl_players_position_team ON nfl_players(position, team);
CREATE INDEX idx_nfl_players_age ON nfl_players(age);
CREATE INDEX idx_nfl_players_full_name_trgm ON nfl_players USING GIN (full_name gin_trgm_ops);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_nfl_players_updated_at
  BEFORE UPDATE ON nfl_players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE nfl_players ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON nfl_players
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON nfl_players
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON nfl_players
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON nfl_players
  FOR DELETE
  USING (auth.role() = 'service_role');
