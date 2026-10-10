-- BADMINTON production only: project ref yadexibmjmnjfmfabrug.
-- Applied to Badminton production 2026-10-10 (migration 20261010200831).
-- NEVER execute in JohannasGartenwelt.
-- TRUNCATE bypasses PostgreSQL row-level security.
begin;
revoke truncate on all tables in schema public from public, anon, authenticated;
commit;

-- Also applied: harden_postgres_default_truncate_v49_20261010
-- For future public tables created as role postgres:
alter default privileges for role postgres in schema public
 revoke truncate on tables from anon, authenticated;

-- The pre-existing default ACL for owner supabase_admin still grants
-- TRUNCATE on FUTURE tables to anon/authenticated. That owner must explicitly
-- harden its default privileges via a separately authorized action.
-- Effective privilege audit after applying in the correct project.
-- All anon_can_truncate and signed_in_can_truncate values must be false.
select c.relname as table_name,
       has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_can_truncate,
       has_table_privilege('authenticated', c.oid, 'TRUNCATE') as signed_in_can_truncate
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
order by c.relname;

-- Check which SELECT grants and RLS policies remain in place separately.
-- Do not assume that removal of TRUNCATE removes other excessive grants.
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated')
order by table_name,grantee,privilege_type;
