-- Create a wrapper function that invokes the sync-league-rosters edge function
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
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule daily sync at 9:00 AM UTC
-- Cron expression: '0 9 * * *' = minute hour day month weekday
SELECT cron.schedule(
  'sync-league-rosters-daily',
  '0 9 * * *',
  'SELECT invoke_sync_league_rosters();'
);

-- Query to view the scheduled job:
-- SELECT * FROM cron.job WHERE jobname = 'sync-league-rosters-daily';

-- Query to view job execution history:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-league-rosters-daily')
-- ORDER BY start_time DESC LIMIT 10;

-- To manually trigger the job for testing:
-- SELECT invoke_sync_league_rosters();

-- To disable/remove the cron job:
-- SELECT cron.unschedule('sync-league-rosters-daily');
