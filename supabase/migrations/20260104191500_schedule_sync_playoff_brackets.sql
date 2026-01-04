-- Create wrapper function for sync-playoff-brackets edge function
CREATE OR REPLACE FUNCTION invoke_sync_playoff_brackets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Schedule playoff brackets sync on Tuesdays at 10:05 AM UTC
-- Runs 5 minutes after weekly matchups sync
-- Only relevant during postseason but safe to run year-round
-- Cron expression: '5 10 * * 2' = 10:05 AM every Tuesday
SELECT cron.schedule(
  'sync-playoff-brackets',
  '5 10 * * 2',
  'SELECT invoke_sync_playoff_brackets();'
);

-- Query to view the scheduled job:
-- SELECT * FROM cron.job WHERE jobname = 'sync-playoff-brackets';

-- To manually trigger the job for testing:
-- SELECT invoke_sync_playoff_brackets();

-- To disable/remove the cron job:
-- SELECT cron.unschedule('sync-playoff-brackets');
