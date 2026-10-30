-- #414: schedule private DBV check at four fixed UTC checkpoints each day.
-- The DB-level claim/backoff prevents external downloads more than once per 24h.
-- A once-daily cron at 12:15 UTC preceded next_allowed_at 17:55 UTC and
-- inadvertently delayed the next permitted source read by another full day.
-- This change DOES NOT reset backoff, invoke the importer, expose secrets,
-- alter access/RLS, or publish the app.
DO $migration$
DECLARE
  dbv_job bigint;
BEGIN
  SELECT jobid INTO dbv_job
    FROM cron.job
   WHERE jobname='badminton-private-dbv-weekly-daily-v2'
     AND active IS TRUE;
  IF dbv_job IS NULL THEN
    RAISE EXCEPTION 'missing active private DBV scheduler; not creating duplicate';
  END IF;
  PERFORM cron.alter_job(
    job_id := dbv_job,
    schedule := '15 0,6,12,18 * * *'
  );
END
$migration$;
