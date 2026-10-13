-- Badminton / Schmetterlinge: READ-ONLY, ON-DEMAND operational health audit
-- Project: yadexibmjmnjfmfabrug ONLY (never the Gartenwelt project).
-- Run from an authorized Supabase SQL Editor. Does not create users, logs, jobs or charges.
-- Keep output aggregated: NEVER export player IDs, invite tokens, IPs or personal payloads.
-- SQL cron success reports SQL execution, NOT successful source imports or fresh sport data.

-- 1. Existing exposed public-table baseline; ALL *_violations must be zero.
select count(*) as public_tables,
  count(*) filter (where not c.relrowsecurity) as rls_disabled,
  count(*) filter (where has_table_privilege('anon',c.oid,'TRUNCATE')
                      or has_table_privilege('authenticated',c.oid,'TRUNCATE')) as truncate_browser,
  count(*) filter (where has_table_privilege('anon',c.oid,'TRIGGER')
                      or has_table_privilege('authenticated',c.oid,'TRIGGER')) as trigger_browser,
  count(*) filter (where has_table_privilege('anon',c.oid,'REFERENCES')
                      or has_table_privilege('authenticated',c.oid,'REFERENCES')) as references_browser,
  count(*) filter (where has_table_privilege('anon',c.oid,'MAINTAIN')
                      or has_table_privilege('authenticated',c.oid,'MAINTAIN')) as maintain_browser
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p');

-- 2. Future defaults: any browser grantee with D/t/x/m requires owner-authorized remediation.
-- Explicit SELECT/INSERT/etc grants on live tables must be reviewed separately.
select owner.rolname as future_object_owner, n.nspname as schema,
  d.defaclobjtype as object_kind,
  split_part(acl.entry::text,'=',1) as grantee,
  split_part(split_part(acl.entry::text,'=',2),'/',1) as granted_privileges
from pg_catalog.pg_default_acl d
join pg_catalog.pg_roles owner on owner.oid=d.defaclrole
join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
cross join lateral unnest(d.defaclacl) as acl(entry)
where n.nspname='public' and owner.rolname in ('postgres','supabase_admin')
  and split_part(acl.entry::text,'=',1) in ('anon','authenticated')
order by owner.rolname,d.defaclobjtype,grantee;

-- 3. Cron reliability, rolling 24 h. 0 runs on weekly/less frequent jobs is normal.
-- Scheduled job names are operational metadata; no personal identifiers returned.
select j.jobname,j.schedule,j.active,
  count(r.runid) filter (where r.start_time > now()-interval '24 hours') as runs_24h,
  count(r.runid) filter (where r.start_time > now()-interval '24 hours'
                         and r.status not in ('succeeded','running')) as failed_24h,
  count(r.runid) filter (where r.start_time > now()-interval '24 hours'
                         and r.status='running') as running_24h,
  max(r.end_time) filter (where r.status='succeeded') as last_success
from cron.job j
left join cron.job_run_details r on r.jobid=j.jobid
                             and r.start_time > now()-interval '7 days'
group by j.jobname,j.schedule,j.active
order by j.jobname;

-- 4. Public calendar snapshot age and year coverage; judge data completeness separately.
select extract(year from start_date)::int as event_year,
  count(*) as events,
  max(last_seen_at) as latest_seen_at
from public.dbv_calendar_entries
group by extract(year from start_date)::int
order by event_year;

-- 5. Import queues: only status aggregates, never the DBV ID or detail field.
select 'history' as source,status,count(*) as jobs
from public.player_history_imports group by status
union all
select 'external_matches',status,count(*)
from public.player_external_match_imports group by status
order by source,status;

-- 6. Demand-aware live cache freshness (may be empty outside matchdays).
select count(*) as snapshots,max(checked_at) as last_checked_at,
       count(*) filter(where checked_at < now()-interval '1 day') as over_24h_old
from public.player_live_snapshots;

-- 7. Auth/private invitations: aggregated only; not a test of real creation or revocation.
select (select count(*) from auth.users) as auth_users,
       (select count(*) from public.private_tournament_invites) as private_invites;

-- Additional checks outside SQL: Security Advisor; GitHub Actions latest import/deploy;
-- compare imported DBV event totals with official sources; Supabase edge function versions.
-- Cloudflare billing, account payment method, real iPhone tests and full restore
-- CANNOT be inferred from these DB queries. See GitHub issues #54/#56/#139/#153/#157.
