-- Fix 2023 draft picks: set is_keeper = false for rounds 1-6
-- 2023 was the league's first season, so there were no keepers
UPDATE draft_picks
SET is_keeper = false
WHERE draft_id = '994425886080401408' AND round <= 6;
