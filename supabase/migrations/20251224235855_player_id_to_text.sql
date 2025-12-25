-- Change player_id from INTEGER to TEXT to support team defense IDs (e.g., "HOU")
ALTER TABLE nfl_players
  ALTER COLUMN player_id TYPE TEXT USING player_id::TEXT;
