-- Create weekly_rosters table to store weekly roster snapshots
-- This captures which players were on each roster for each week
CREATE TABLE weekly_rosters (
  id BIGSERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  roster_id INTEGER NOT NULL,
  player_ids TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, week, roster_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_weekly_rosters_season_week ON weekly_rosters(season_id, week);
CREATE INDEX idx_weekly_rosters_roster ON weekly_rosters(roster_id);
CREATE INDEX idx_weekly_rosters_player_ids ON weekly_rosters USING GIN(player_ids);

-- Enable Row Level Security
ALTER TABLE weekly_rosters ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON weekly_rosters
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON weekly_rosters
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON weekly_rosters
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON weekly_rosters
  FOR DELETE
  USING (auth.role() = 'service_role');
