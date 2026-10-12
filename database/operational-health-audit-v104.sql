-- Schmetterlinge, 2026-10-12: READ-ONLY operational audit.
-- Run only in Supabase project yadexibmjmnjfmfabrug, with an admin connection.
-- No player IDs, names, request payloads, secrets or changes to production.
-- Each statement may be run independently. Do not execute in the public Data API.

-- 1. Cron status for the previous 24 h (idle schedules may have zero runs).
SELECT j.jobname,j.schedule,j.active,
       count(d.jobid) AS runs_24h,
       count(d.jobid) FILTER (WHERE d.status <> 'succeeded') AS failed_runs_24h,
       max(d.start_time) AS last_run_at,
       max(d.start_time) FILTER (WHERE d.status <> 'succeeded') AS last_failure_at
FROM cron.job j LEFT JOIN cron.job_run_details d
 ON d.jobid=j.jobid AND d.start_time >= now()-interval '24 hours'
WHERE j.jobname LIKE 'badminton-%'
GROUP BY j.jobid,j.jobname,j.schedule,j.active
ORDER BY j.jobname;

-- 2. Data freshness and request health: aggregates only, never personal IDs.
SELECT
 (SELECT count(*) FROM public.dbv_calendar_entries) AS calendar_entries,
 (SELECT max(last_seen_at) FROM public.dbv_calendar_entries) AS calendar_last_seen_at,
 (SELECT count(*) FROM public.player_external_match_imports) AS history_requests,
 (SELECT count(*) FROM public.player_external_match_imports WHERE status='error') AS history_errors,
 (SELECT count(*) FROM public.player_external_match_imports
   WHERE status='loading' AND lease_until < now()) AS expired_history_leases,
 (SELECT count(*) FROM public.player_live_snapshots) AS live_snapshot_count,
 (SELECT count(*) FROM public.player_live_snapshots
   WHERE last_error_at IS NOT NULL
     AND (checked_at IS NULL OR last_error_at>checked_at)) AS live_snapshot_errors;

-- 3. Existing table privileges and RLS, with no changes.
SELECT count(*) AS public_tables,
 count(*) FILTER (WHERE NOT c.relrowsecurity) AS without_rls,
 count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'TRUNCATE')) AS anon_truncate,
 count(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'TRUNCATE')) AS auth_truncate,
 count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'TRIGGER')) AS anon_trigger,
 count(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'TRIGGER')) AS auth_trigger,
 count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'REFERENCES')) AS anon_references,
 count(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'REFERENCES')) AS auth_references
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r';

-- 4. Future-object default ACL exposure (supabase_admin requires OWNER-side fix).
SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname AS schema_name,
       d.defaclobjtype AS object_kind,d.defaclacl::text AS default_acl
FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname='public'
ORDER BY owner,object_kind;

-- 5. Database budget trend; compare across audit dates, not against guessed quotas.
SELECT now() AS observed_at,
       pg_database_size(current_database()) AS database_bytes,
       pg_size_pretty(pg_database_size(current_database())) AS database_human;
