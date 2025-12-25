-- Create enum types for transactions
CREATE TYPE transaction_type AS ENUM ('trade', 'free_agent', 'waiver');
CREATE TYPE transaction_status AS ENUM ('complete', 'failed', 'pending');

-- Create transactions table to store all roster moves
-- Includes trades, waiver claims, and free agent pickups
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL,
  roster_ids INTEGER[],
  adds JSONB,
  drops JSONB,
  draft_picks JSONB,
  waiver_budget JSONB,
  settings JSONB,
  creator_id TEXT,
  created_at_sleeper BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_transactions_season_week ON transactions(season_id, week);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_roster_ids ON transactions USING GIN(roster_ids);
CREATE INDEX idx_transactions_adds ON transactions USING GIN(adds);
CREATE INDEX idx_transactions_drops ON transactions USING GIN(drops);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - only authenticated users
CREATE POLICY "Enable read access for authenticated users only" ON transactions
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: INSERT - only authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: UPDATE - only authenticated users
CREATE POLICY "Enable update for authenticated users only" ON transactions
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: DELETE - only service role
CREATE POLICY "Enable delete for service role only" ON transactions
  FOR DELETE
  USING (auth.role() = 'service_role');
