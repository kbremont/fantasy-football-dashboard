-- Update invoke functions to use Supabase Vault for secure secret storage
-- IMPORTANT: You must manually add your service role key to the vault first:
-- SELECT vault.create_secret('your-service-role-key', 'service_role_key');

-- Update sync-nfl-players invoke function
CREATE OR REPLACE FUNCTION invoke_sync_nfl_players()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Update sync-league-rosters invoke function
CREATE OR REPLACE FUNCTION invoke_sync_league_rosters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Update sync-weekly-matchups invoke function
CREATE OR REPLACE FUNCTION invoke_sync_weekly_matchups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Update sync-weekly-transactions invoke function
CREATE OR REPLACE FUNCTION invoke_sync_weekly_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
