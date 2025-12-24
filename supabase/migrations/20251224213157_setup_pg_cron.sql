-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a wrapper function that invokes the edge function
-- This approach is more reliable than using net.http_post directly in cron.schedule
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
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule daily sync at 9:00 AM UTC
-- Cron expression: '0 9 * * *' = minute hour day month weekday
-- This runs every day at 9:00 AM UTC (changed from weekly Tuesday)
SELECT cron.schedule(
  'sync-nfl-players-daily',
  '0 9 * * *',
  'SELECT invoke_sync_nfl_players();'
);

-- Query to view the scheduled job
-- Run this to verify the cron job was created:
-- SELECT * FROM cron.job WHERE jobname = 'sync-nfl-players-daily';

-- Query to view job execution history
-- Run this to see past executions:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-nfl-players-daily')
-- ORDER BY start_time DESC LIMIT 10;

-- To manually trigger the job for testing:
-- SELECT invoke_sync_nfl_players();

-- To disable/remove the cron job:
-- SELECT cron.unschedule('sync-nfl-players-daily');
