-- Drafts table (metadata about each draft)
CREATE TABLE drafts (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT NOT NULL UNIQUE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  league_id TEXT NOT NULL,
  type TEXT,
  status TEXT,
  start_time BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft picks table (individual picks)
CREATE TABLE draft_picks (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(draft_id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  pick_no INTEGER NOT NULL,
  roster_id INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  is_keeper BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, round, pick_no)
);

-- Indexes
CREATE INDEX idx_drafts_season_id ON drafts(season_id);
CREATE INDEX idx_draft_picks_roster_id ON draft_picks(roster_id);
CREATE INDEX idx_draft_picks_player_id ON draft_picks(player_id);
CREATE INDEX idx_draft_picks_is_keeper ON draft_picks(is_keeper) WHERE is_keeper = true;

-- RLS policies
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access on drafts" ON drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role full access on drafts" ON drafts FOR ALL TO service_role USING (true);

CREATE POLICY "Allow authenticated read access on draft_picks" ON draft_picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role full access on draft_picks" ON draft_picks FOR ALL TO service_role USING (true);
