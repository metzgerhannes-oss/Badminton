-- v250: privacy-first on-demand only. The earlier background experiment
-- was disabled on 2026-11-07. This cleanup is idempotent.
DO $do$ BEGIN
 IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='badminton-dbv-matchday-five-minutes')
 THEN PERFORM cron.unschedule('badminton-dbv-matchday-five-minutes'); END IF;
END $do$;
DROP FUNCTION IF EXISTS private.dispatch_dbv_matchday_v250();
DROP FUNCTION IF EXISTS public.dbv_matchday_cron_authorized(text);
DELETE FROM vault.secrets WHERE name='dbv_matchday_cron_token';
