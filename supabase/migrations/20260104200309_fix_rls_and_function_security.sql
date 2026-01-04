-- Migration: Fix RLS InitPlan performance and function search_path security
-- Fixes 39 Supabase advisor warnings:
--   - 32 RLS policies using auth.role() without subquery (performance)
--   - 7 functions without explicit search_path (security)

--------------------------------------------------------------------------------
-- PART 1: Fix RLS Policies
-- Wrap auth.role() in (select auth.role()) to prevent per-row re-evaluation
--------------------------------------------------------------------------------

-- =============================================================================
-- Table: nfl_players
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON nfl_players;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON nfl_players;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON nfl_players;
DROP POLICY IF EXISTS "Enable delete for service role only" ON nfl_players;

CREATE POLICY "Enable read access for authenticated users only" ON nfl_players
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON nfl_players
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON nfl_players
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON nfl_players
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================================================
-- Table: rosters
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON rosters;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON rosters;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON rosters;
DROP POLICY IF EXISTS "Enable delete for service role only" ON rosters;

CREATE POLICY "Enable read access for authenticated users only" ON rosters
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON rosters
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON rosters
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON rosters
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================================================
-- Table: seasons
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON seasons;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON seasons;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON seasons;
DROP POLICY IF EXISTS "Enable delete for service role only" ON seasons;

CREATE POLICY "Enable read access for authenticated users only" ON seasons
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON seasons
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON seasons
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON seasons
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================================================
-- Table: weekly_rosters
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON weekly_rosters;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON weekly_rosters;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON weekly_rosters;
DROP POLICY IF EXISTS "Enable delete for service role only" ON weekly_rosters;

CREATE POLICY "Enable read access for authenticated users only" ON weekly_rosters
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON weekly_rosters
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON weekly_rosters
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON weekly_rosters
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================================================
-- Table: matchups
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON matchups;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON matchups;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON matchups;
DROP POLICY IF EXISTS "Enable delete for service role only" ON matchups;

CREATE POLICY "Enable read access for authenticated users only" ON matchups
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON matchups
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON matchups
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON matchups
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================================================
-- Table: transactions
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON transactions;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON transactions;
DROP POLICY IF EXISTS "Enable delete for service role only" ON transactions;

CREATE POLICY "Enable read access for authenticated users only" ON transactions
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON transactions
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON transactions
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON transactions
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================================================
-- Table: player_weekly_points
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON player_weekly_points;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON player_weekly_points;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON player_weekly_points;
DROP POLICY IF EXISTS "Enable delete for service role only" ON player_weekly_points;

CREATE POLICY "Enable read access for authenticated users only" ON player_weekly_points
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON player_weekly_points
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON player_weekly_points
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON player_weekly_points
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================================================
-- Table: playoff_brackets
-- =============================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON playoff_brackets;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON playoff_brackets;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON playoff_brackets;
DROP POLICY IF EXISTS "Enable delete for service role only" ON playoff_brackets;

CREATE POLICY "Enable read access for authenticated users only" ON playoff_brackets
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable insert for authenticated users only" ON playoff_brackets
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable update for authenticated users only" ON playoff_brackets
  FOR UPDATE
  USING ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'authenticated' OR (select auth.role()) = 'service_role');

CREATE POLICY "Enable delete for service role only" ON playoff_brackets
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

--------------------------------------------------------------------------------
-- PART 2: Fix Function Search Paths
-- Add SET search_path = '' to prevent search path injection attacks
--------------------------------------------------------------------------------

-- =============================================================================
-- Function: update_updated_at_column
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =============================================================================
-- Function: invoke_sync_nfl_players
-- =============================================================================
CREATE OR REPLACE FUNCTION invoke_sync_nfl_players()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fnphwakozzgoqpoidpvq.supabase.co/functions/v1/sync-nfl-players',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- =============================================================================
-- Function: invoke_sync_league_rosters
-- =============================================================================
CREATE OR REPLACE FUNCTION invoke_sync_league_rosters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fnphwakozzgoqpoidpvq.supabase.co/functions/v1/sync-league-rosters',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- =============================================================================
-- Function: invoke_sync_weekly_matchups
-- =============================================================================
CREATE OR REPLACE FUNCTION invoke_sync_weekly_matchups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fnphwakozzgoqpoidpvq.supabase.co/functions/v1/sync-weekly-matchups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- =============================================================================
-- Function: invoke_sync_weekly_transactions
-- =============================================================================
CREATE OR REPLACE FUNCTION invoke_sync_weekly_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fnphwakozzgoqpoidpvq.supabase.co/functions/v1/sync-weekly-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- =============================================================================
-- Function: invoke_sync_cfb_player_stats
-- =============================================================================
CREATE OR REPLACE FUNCTION invoke_sync_cfb_player_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fnphwakozzgoqpoidpvq.supabase.co/functions/v1/sync-cfb-player-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- =============================================================================
-- Function: invoke_sync_playoff_brackets
-- =============================================================================
CREATE OR REPLACE FUNCTION invoke_sync_playoff_brackets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fnphwakozzgoqpoidpvq.supabase.co/functions/v1/sync-playoff-brackets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;
