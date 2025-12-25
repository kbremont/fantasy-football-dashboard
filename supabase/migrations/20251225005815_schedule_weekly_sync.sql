-- Create wrapper function for sync-weekly-matchups edge function
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
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Create wrapper function for sync-weekly-transactions edge function
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
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule weekly matchups sync on Tuesdays at 10:00 AM UTC
-- Tuesday is chosen because:
-- 1. Monday Night Football has completed
-- 2. Stat corrections have been applied
-- Cron expression: '0 10 * * 2' = 10:00 AM every Tuesday
SELECT cron.schedule(
  'sync-weekly-matchups',
  '0 10 * * 2',
  'SELECT invoke_sync_weekly_matchups();'
);

-- Schedule weekly transactions sync on Tuesdays at 10:00 AM UTC
SELECT cron.schedule(
  'sync-weekly-transactions',
  '0 10 * * 2',
  'SELECT invoke_sync_weekly_transactions();'
);

-- Query to view the scheduled jobs:
-- SELECT * FROM cron.job WHERE jobname IN ('sync-weekly-matchups', 'sync-weekly-transactions');

-- Query to view job execution history:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname IN ('sync-weekly-matchups', 'sync-weekly-transactions'))
-- ORDER BY start_time DESC LIMIT 10;

-- To manually trigger the jobs for testing:
-- SELECT invoke_sync_weekly_matchups();
-- SELECT invoke_sync_weekly_transactions();

-- To disable/remove the cron jobs:
-- SELECT cron.unschedule('sync-weekly-matchups');
-- SELECT cron.unschedule('sync-weekly-transactions');
