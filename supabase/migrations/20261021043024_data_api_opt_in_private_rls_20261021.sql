-- Production-applied 2026-10-21, Supabase migration id 20261021043024.
-- Keep new public tables private by default; existing table GRANTs unchanged.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
-- Owner-run cron/jobs still bypass RLS; no public SELECT grants were added.
alter table private.external_match_attempts enable row level security;
alter table private.external_match_quarantine enable row level security;
alter table private.team_import_demands enable row level security;
revoke all on table private.external_match_attempts,
                    private.external_match_quarantine,
                    private.team_import_demands
  from public, anon, authenticated;
