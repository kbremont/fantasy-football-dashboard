-- Add 2026 season and set it as current

-- Set 2025 season as not current
UPDATE seasons
SET is_current = false, updated_at = now()
WHERE season_year = 2025;

-- Insert 2026 season as current
INSERT INTO seasons (season_year, sleeper_league_id, is_current, total_weeks)
VALUES (2026, '1313287838560698368', true, 18);
