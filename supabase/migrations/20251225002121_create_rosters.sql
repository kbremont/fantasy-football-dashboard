-- Create rosters table to store league roster metadata
CREATE TABLE rosters (
  roster_id INTEGER PRIMARY KEY,
  owner_id TEXT NOT NULL,
  team_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for owner_id lookups
CREATE INDEX idx_rosters_owner_id ON rosters(owner_id);

-- Create trigger to automatically update updated_at
-- Reuses the function created in create_nfl_players migration
CREATE TRIGGER update_rosters_updated_at
  BEFORE UPDATE ON rosters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON rosters
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON rosters
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON rosters
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON rosters
  FOR DELETE
  USING (auth.role() = 'service_role');
