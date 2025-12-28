-- Schedule CFBD player stats sync cron job
-- Runs weekly on Sundays at 6:00 AM UTC (after weekend CFB games)

-- Create invoke function for CFB player stats sync
CREATE OR REPLACE FUNCTION invoke_sync_cfb_player_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Schedule weekly sync (Sundays at 6:00 AM UTC)
SELECT cron.schedule(
  'sync-cfb-player-stats-weekly',
  '0 6 * * 0',
  'SELECT invoke_sync_cfb_player_stats()'
);
