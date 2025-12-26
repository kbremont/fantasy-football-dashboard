-- Create player_team_history table for tracking NFL team changes over time
-- This enables point-in-time lookups for historical matchup data

CREATE TABLE player_team_history (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  team TEXT,  -- NULL means free agent/unsigned
  effective_date DATE NOT NULL,
  source TEXT NOT NULL,  -- 'initial_seed', 'daily_sync', 'transaction'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient point-in-time lookups
-- Query pattern: WHERE player_id = ? AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1
CREATE INDEX idx_player_team_history_lookup
ON player_team_history(player_id, effective_date DESC);

-- Index for finding all changes for a player (timeline view)
CREATE INDEX idx_player_team_history_player
ON player_team_history(player_id);

-- Add comment explaining the table purpose
COMMENT ON TABLE player_team_history IS 'Tracks NFL player team affiliations over time for historical accuracy in matchup views';
COMMENT ON COLUMN player_team_history.effective_date IS 'The date this team affiliation became effective';
COMMENT ON COLUMN player_team_history.source IS 'How this record was created: initial_seed (baseline), daily_sync (detected change), transaction (trade/waiver)';

-- Seed with current nfl_players data using a past date as baseline
-- This ensures historical queries always find a record
INSERT INTO player_team_history (player_id, team, effective_date, source)
SELECT player_id, team, '2020-01-01'::DATE, 'initial_seed'
FROM nfl_players
WHERE team IS NOT NULL;

-- Enable RLS
ALTER TABLE player_team_history ENABLE ROW LEVEL SECURITY;

-- RLS policies matching other tables
CREATE POLICY "Allow read access for authenticated users and service role" ON player_team_history
  FOR SELECT
  TO authenticated, service_role
  USING (true);

CREATE POLICY "Allow insert for authenticated users and service role" ON player_team_history
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users and service role" ON player_team_history
  FOR UPDATE
  TO authenticated, service_role
  USING (true);

CREATE POLICY "Allow delete for service role only" ON player_team_history
  FOR DELETE
  TO service_role
  USING (true);
