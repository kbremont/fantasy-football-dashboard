-- Allow all players from Sleeper API (not just active fantasy positions)

-- Step 1: Change position column from enum to TEXT (nullable)
ALTER TABLE nfl_players
  ALTER COLUMN position TYPE TEXT USING position::TEXT,
  ALTER COLUMN position DROP NOT NULL;

-- Step 2: Make team column nullable (for free agents/retired players)
ALTER TABLE nfl_players
  ALTER COLUMN team DROP NOT NULL;

-- Step 3: Drop the position_enum type (no longer needed)
DROP TYPE position_enum;
