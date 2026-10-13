-- Badminton Supabase only: yadexibmjmnjfmfabrug.
-- Production already applied and verified on 2026-10-13 (v112 audit trail).
--
-- Why NO "IN SCHEMA public" here?
-- PostgreSQL gives EXECUTE on *new functions* to PUBLIC by a built-in GLOBAL
-- default. A per-schema REVOKE cannot remove that built-in privilege.
-- Unlike the existing per-schema defaults, this global rule is required for
-- future postgres-owned public functions to be inaccessible to anon/auth.
--
-- Idempotent, future defaults ONLY. Existing functions and policies unchanged.
-- Intended migration role: postgres; never impersonate supabase_admin.
-- Once created, intentional RPC endpoints need explicit GRANT EXECUTE to
-- specific client roles after their authorization checks are reviewed.
alter default privileges for role postgres
  revoke execute on functions from public;
