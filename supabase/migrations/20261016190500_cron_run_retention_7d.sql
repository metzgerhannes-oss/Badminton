-- Bounded pg_cron operational history.
-- Scheduled daily; does not delete players, ranking results, sport evidence or fixtures.
-- Seven days retains enough context to diagnose recent failures.
SELECT cron.schedule(
  'badminton-cron-run-retention-7d',
  '5 2 * * *',
  $$DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days'$$
);
